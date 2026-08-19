import React, { useEffect, useMemo, useState } from 'react';
import {
    getLiveConfig, updateLiveConfig, setMatchLiveServers, removeMatchLiveServers,
    importFaborServers, fetchRawMatches, AdminApiError,
    type LiveConfig, type LiveStreamServer, type RawMatch, type OverlayAd, type LogoPlacement,
} from '../../../services/adminApi';

const emptyOverlayAd = (): OverlayAd => ({ enabled: false, imageUrl: '', linkUrl: '', position: 'bottom', closeAfterSec: 0 });

interface Props {
    onUnauthorized: () => void;
}

// Small club/competition logo with a graceful fallback for the match picker.
function PickLogo({ src, alt }: { src?: string; alt: string }) {
    const [broken, setBroken] = useState(false);
    if (!src || broken) {
        return <span className="w-6 h-6 inline-flex items-center justify-center text-[9px] text-gray-300 bg-gray-100 rounded-full">?</span>;
    }
    return <img src={src} alt={alt} loading="lazy" className="w-6 h-6 object-contain" onError={() => setBroken(true)} />;
}

// Colour for the status pill, mirroring the public match card.
function statusPillClass(status: string): string {
    if (status.includes('مباشر') || status.includes('جارية')) return 'bg-red-50 text-red-600 border-red-100';
    if (status.includes('الإستراحة') || status.includes('استراحة')) return 'bg-orange-50 text-orange-600 border-orange-100';
    if (status.includes('انتهت') || status.includes('مؤجلة')) return 'bg-gray-100 text-gray-500 border-gray-200';
    return 'bg-green-50 text-green-600 border-green-100';
}

// Kickoff time (Africa/Casablanca) for a raw match, or '' if unknown.
function rawKickoff(m: RawMatch): string {
    const t = m['Time-Start'];
    if (!t) return '';
    const d = new Date(t);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-GB', { timeZone: 'Africa/Casablanca', hour: '2-digit', minute: '2-digit', hour12: false });
}

const newServer = (): LiveStreamServer => ({
    id: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: '',
    flag: '',
    url: '',
    type: 'iframe',
});

// Import servers from a Fabor-TV match/embed URL. Fetched server-side (proxy rotation
// bypasses Fabor's bot block), previewed, then merged into the current editor.
function FaborImporter({ onImport }: { onImport: (servers: LiveStreamServer[]) => void }) {
    const [url, setUrl] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');

    const run = async () => {
        if (!url.trim()) return;
        setBusy(true);
        setMsg('');
        try {
            const { servers } = await importFaborServers(url.trim());
            if (servers.length === 0) {
                setMsg('No servers found on that page.');
            } else {
                onImport(servers);
                setMsg(`Imported ${servers.length} server(s). Review below, then Save.`);
            }
        } catch (e) {
            setMsg(e instanceof Error ? e.message : 'Import failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="border border-dashed border-emerald-300 bg-emerald-50/40 rounded-lg p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                <input
                    placeholder="Channel / embed page URL (extracts a direct .m3u8 → ad-free player)"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm flex-1 min-w-[240px] font-mono text-xs"
                    dir="ltr"
                />
                <button
                    onClick={run}
                    disabled={busy || !url.trim()}
                    className="text-xs bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded px-3 py-1.5 whitespace-nowrap"
                >
                    {busy ? 'Extracting…' : 'Extract stream'}
                </button>
            </div>
            {msg && <p className="text-xs text-emerald-700">{msg}</p>}
        </div>
    );
}

// Editable list of watch servers (label + flag + url + player type). Used for both the
// global defaults and per-match overrides.
function ServerListEditor({ servers, onChange }: { servers: LiveStreamServer[]; onChange: (s: LiveStreamServer[]) => void }) {
    const update = (idx: number, patch: Partial<LiveStreamServer>) => {
        onChange(servers.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
    };
    const move = (idx: number, dir: -1 | 1) => {
        const next = [...servers];
        const target = idx + dir;
        if (target < 0 || target >= next.length) return;
        [next[idx], next[target]] = [next[target], next[idx]];
        onChange(next);
    };
    return (
        <div className="space-y-2">
            {servers.length === 0 && <p className="text-sm text-gray-400">No servers yet. Add one below.</p>}
            {servers.map((s, idx) => (
                <div key={s.id} className="flex flex-wrap items-center gap-2 border border-gray-200 rounded-lg p-2 bg-gray-50/50">
                    <input
                        placeholder="Label (e.g. AR 1)"
                        value={s.label}
                        onChange={(e) => update(idx, { label: e.target.value })}
                        className="border border-gray-300 rounded px-2 py-1.5 text-sm w-28"
                    />
                    <input
                        placeholder="🇲🇦"
                        title="Flag emoji"
                        value={s.flag || ''}
                        onChange={(e) => update(idx, { flag: e.target.value })}
                        className="border border-gray-300 rounded px-2 py-1.5 text-sm w-14 text-center"
                    />
                    <input
                        placeholder="Stream URL (embed page or .m3u8)"
                        value={s.url}
                        onChange={(e) => update(idx, { url: e.target.value })}
                        className="border border-gray-300 rounded px-2 py-1.5 text-sm flex-1 min-w-[220px] font-mono text-xs"
                        dir="ltr"
                    />
                    <select
                        value={s.type}
                        onChange={(e) => update(idx, { type: e.target.value as LiveStreamServer['type'] })}
                        className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                    >
                        <option value="iframe">Iframe embed</option>
                        <option value="hls">HLS (.m3u8)</option>
                    </select>
                    <div className="flex items-center gap-1">
                        <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-xs px-1.5 py-1 rounded bg-gray-100 disabled:opacity-30" title="Move up">↑</button>
                        <button onClick={() => move(idx, 1)} disabled={idx === servers.length - 1} className="text-xs px-1.5 py-1 rounded bg-gray-100 disabled:opacity-30" title="Move down">↓</button>
                        <button onClick={() => onChange(servers.filter((_, i) => i !== idx))} className="text-xs text-red-600 hover:underline px-1.5">Remove</button>
                    </div>
                </div>
            ))}
            <button
                onClick={() => onChange([...servers, newServer()])}
                className="text-xs bg-gray-800 hover:bg-gray-900 text-white rounded px-3 py-1.5"
            >
                + Add server
            </button>
        </div>
    );
}

// Plain function, not React.FC<Props> — see OverviewTab.tsx comment.
function LiveTab({ onUnauthorized }: Props) {
    const [config, setConfig] = useState<LiveConfig | null>(null);
    const [error, setError] = useState('');
    const [savedMsg, setSavedMsg] = useState('');

    // Global drafts
    const [defaultServers, setDefaultServers] = useState<LiveStreamServer[]>([]);
    const [overlayAd, setOverlayAd] = useState<OverlayAd>(emptyOverlayAd());
    const [logoUrl, setLogoUrl] = useState('');
    const [bottomText, setBottomText] = useState('');
    // Logo placement, % of the video box — lets you park the logo on each broadcaster's
    // own on-screen bug, which sits in a slightly different spot per channel.
    const [logoTopPct, setLogoTopPct] = useState(3);
    const [logoRightPct, setLogoRightPct] = useState(8);
    const [logoSizePct, setLogoSizePct] = useState(18);
    const [logoBackdrop, setLogoBackdrop] = useState(false);
    // Per-channel overrides, plus which one the sliders are currently editing
    // (-1 = the global default above).
    const [placements, setPlacements] = useState<LogoPlacement[]>([]);
    const [editingIdx, setEditingIdx] = useState(-1);

    // Per-match editor
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [matches, setMatches] = useState<RawMatch[]>([]);
    const [matchesLoading, setMatchesLoading] = useState(false);
    const [selectedMatchId, setSelectedMatchId] = useState('');
    const [matchDraft, setMatchDraft] = useState<LiveStreamServer[]>([]);
    const [matchSearch, setMatchSearch] = useState('');

    // The sliders drive one target at a time: the global default (editingIdx -1) or one
    // channel rule. These read/write whichever is selected, so the slider markup below
    // stays single-purpose instead of being duplicated per rule.
    const editing = editingIdx >= 0 ? placements[editingIdx] : null;
    const curTop = editing ? editing.topPct : logoTopPct;
    const curRight = editing ? editing.rightPct : logoRightPct;
    const curSize = editing ? editing.sizePct : logoSizePct;
    const curBackdrop = editing ? editing.backdrop : logoBackdrop;
    const patchEditing = (patch: Partial<LogoPlacement>) => {
        if (editingIdx < 0) {
            if (patch.topPct !== undefined) setLogoTopPct(patch.topPct);
            if (patch.rightPct !== undefined) setLogoRightPct(patch.rightPct);
            if (patch.sizePct !== undefined) setLogoSizePct(patch.sizePct);
            if (patch.backdrop !== undefined) setLogoBackdrop(patch.backdrop);
            return;
        }
        setPlacements(list => list.map((r, i) => (i === editingIdx ? { ...r, ...patch } : r)));
    };

    const handleError = (e: unknown, fallbackMsg: string) => {
        if (e instanceof AdminApiError && e.status === 401) return onUnauthorized();
        setError(e instanceof Error ? e.message : fallbackMsg);
    };

    const applyConfig = (cfg: LiveConfig) => {
        setConfig(cfg);
        setDefaultServers(cfg.defaultServers);
        setOverlayAd({ ...emptyOverlayAd(), ...(cfg.overlayAd || {}) });
        setLogoUrl(cfg.logoUrl || '');
        setBottomText(cfg.bottomText || '');
        setLogoTopPct(cfg.logoTopPct ?? 3);
        setLogoRightPct(cfg.logoRightPct ?? 8);
        setLogoSizePct(cfg.logoSizePct ?? 18);
        setLogoBackdrop(cfg.logoBackdrop === true);
        setPlacements(cfg.logoPlacements || []);
        setEditingIdx(-1);
    };

    useEffect(() => {
        let cancelled = false;
        getLiveConfig()
            .then(cfg => { if (!cancelled) applyConfig(cfg); })
            .catch(e => { if (!cancelled) handleError(e, 'Failed to load live config'); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let cancelled = false;
        Promise.resolve().then(() => { if (!cancelled) setMatchesLoading(true); });
        fetchRawMatches(date)
            .then(data => { if (!cancelled) setMatches(data); })
            .finally(() => { if (!cancelled) setMatchesLoading(false); });
        return () => { cancelled = true; };
    }, [date]);

    const flashSaved = () => {
        setSavedMsg('Saved ✓');
        setError('');
        setTimeout(() => setSavedMsg(''), 2500);
    };

    const saveGlobal = async (patch: Partial<Omit<LiveConfig, 'matchServers'>>) => {
        try {
            const cfg = await updateLiveConfig(patch);
            applyConfig(cfg);
            flashSaved();
        } catch (e) {
            handleError(e, 'Failed to save');
        }
    };

    const selectMatch = (id: string) => {
        setSelectedMatchId(id);
        setMatchDraft(config?.matchServers[id] ? [...config.matchServers[id]] : []);
    };

    const saveMatchServers = async () => {
        if (!selectedMatchId) return;
        try {
            const cfg = await setMatchLiveServers(selectedMatchId, matchDraft.filter(s => s.url.trim()));
            applyConfig(cfg);
            flashSaved();
        } catch (e) {
            handleError(e, 'Failed to save match servers');
        }
    };

    const clearMatchServers = async (id: string) => {
        try {
            const cfg = await removeMatchLiveServers(id);
            applyConfig(cfg);
            if (id === selectedMatchId) setMatchDraft([]);
            flashSaved();
        } catch (e) {
            handleError(e, 'Failed to clear match servers');
        }
    };

    // Case-insensitive filter over team names, league and id.
    const filteredMatches = useMemo(() => {
        const q = matchSearch.trim().toLowerCase();
        if (!q) return matches;
        return matches.filter(m => {
            const hay = `${m['Team-Right']?.Name || ''} ${m['Team-Left']?.Name || ''} ${m['Cup-Name'] || ''} ${m['Match-id']}`.toLowerCase();
            return hay.includes(q);
        });
    }, [matches, matchSearch]);

    if (!config) {
        return <p className="text-sm text-gray-400">{error || 'Loading…'}</p>;
    }

    return (
        <div className="space-y-6">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}
            {savedMsg && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2">{savedMsg}</div>}

            {/* Master switch */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Live stream section</h3>
                    <p className="text-sm text-gray-600 mt-1">Show the admin-managed watch section (server tabs + player) on match pages.</p>
                </div>
                <button
                    onClick={() => saveGlobal({ enabled: !config.enabled })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${config.enabled ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}
                >
                    {config.enabled ? 'Enabled' : 'Disabled'}
                </button>
            </div>

            {/* Default servers */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Default watch servers</h3>
                <p className="text-sm text-gray-600">Shown on every match unless the match has its own list below. Tab order = list order.</p>
                <FaborImporter onImport={(s) => setDefaultServers(prev => [...prev, ...s])} />
                <ServerListEditor servers={defaultServers} onChange={setDefaultServers} />
                <button
                    onClick={() => saveGlobal({ defaultServers: defaultServers.filter(s => s.url.trim()) })}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg px-4 py-2"
                >
                    Save default servers
                </button>
            </div>

            {/* Your own overlay ad on the player */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Your ad on the player</h3>
                        <p className="text-sm text-gray-600 mt-1">An image banner shown OVER the live player (yours, not the channel's). Add a link to make it clickable.</p>
                    </div>
                    <button
                        onClick={() => setOverlayAd(a => ({ ...a, enabled: !a.enabled }))}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${overlayAd.enabled ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}
                    >
                        {overlayAd.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-gray-500">Image URL (banner)
                        <input value={overlayAd.imageUrl} onChange={e => setOverlayAd(a => ({ ...a, imageUrl: e.target.value }))} placeholder="https://…/banner.png" dir="ltr" className="border border-gray-300 rounded px-2 py-1.5 text-sm font-mono text-xs" />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-gray-500">Click link (optional)
                        <input value={overlayAd.linkUrl} onChange={e => setOverlayAd(a => ({ ...a, linkUrl: e.target.value }))} placeholder="https://your-site.com" dir="ltr" className="border border-gray-300 rounded px-2 py-1.5 text-sm font-mono text-xs" />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-gray-500">Position
                        <select value={overlayAd.position} onChange={e => setOverlayAd(a => ({ ...a, position: e.target.value as OverlayAd['position'] }))} className="border border-gray-300 rounded px-2 py-1.5 text-sm">
                            <option value="bottom">Bottom (banner)</option>
                            <option value="top">Top (banner)</option>
                            <option value="bottom-left">Bottom-left corner</option>
                            <option value="bottom-right">Bottom-right corner</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-gray-500">Auto-hide after (seconds, 0 = stays)
                        <input type="number" min={0} max={300} value={overlayAd.closeAfterSec} onChange={e => setOverlayAd(a => ({ ...a, closeAfterSec: Number(e.target.value) || 0 }))} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
                    </label>
                </div>
                {overlayAd.imageUrl && (
                    <div className="rounded-lg bg-gray-900 p-3 flex items-center justify-center">
                        <img src={overlayAd.imageUrl} alt="preview" className="max-h-20 w-auto object-contain rounded" />
                    </div>
                )}
                <button
                    onClick={() => saveGlobal({ overlayAd })}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg px-4 py-2"
                >
                    Save ad
                </button>
            </div>

            {/* Player branding: your logo (top corner) + bottom text line */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Player branding</h3>
                    <p className="text-sm text-gray-600 mt-1">Your logo in the top corner and a text line across the bottom of the live player. Leave blank to hide.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1 text-xs text-gray-500">Logo image URL
                        <input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://your-site.com/logo.png" dir="ltr" className="border border-gray-300 rounded px-2 py-1.5 text-sm font-mono text-xs" />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-gray-500">Bottom text (max 200 chars)
                        <input value={bottomText} onChange={e => setBottomText(e.target.value)} maxLength={200} placeholder="شاهد مبارياتك فقط عبر موقعك" className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
                    </label>
                </div>
                {/* Logo placement. Broadcasters burn their own bug (ESPN, beIN, ...) into the
                    stream at a different spot per channel, so these nudge our logo onto it. */}
                <div className="border-t border-gray-100 pt-3 space-y-3">
                    <p className="text-xs text-gray-500">
                        Logo placement, as a % of the video — use it to park your logo on top of the broadcaster&apos;s own
                        on-screen bug (the ESPN / beIN mark), which is burned into the stream and can&apos;t be removed.
                        Percentages keep it aligned on mobile, desktop and fullscreen alike. Each broadcaster puts its bug
                        somewhere different, so add a per-channel rule for any channel the default doesn&apos;t suit.
                    </p>

                    {/* Which target the sliders edit: the default, or one channel rule. */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            onClick={() => setEditingIdx(-1)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${editingIdx === -1
                                ? 'bg-green-600 text-white border-green-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'}`}
                        >
                            Default (all channels)
                        </button>
                        {placements.map((r, i) => (
                            <button
                                key={i}
                                onClick={() => setEditingIdx(i)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${editingIdx === i
                                    ? 'bg-green-600 text-white border-green-600'
                                    : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'}`}
                            >
                                {r.match || '(unnamed)'}
                            </button>
                        ))}
                        <button
                            onClick={() => {
                                setPlacements(list => [...list, { match: '', topPct: curTop, rightPct: curRight, sizePct: curSize, backdrop: curBackdrop }]);
                                setEditingIdx(placements.length);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-dashed border-gray-400 text-gray-600 hover:border-green-500 hover:text-green-700"
                        >
                            + Add channel rule
                        </button>
                    </div>

                    {editingIdx >= 0 && (
                        <div className="flex flex-wrap items-end gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <label className="flex flex-col gap-1 text-xs text-gray-500 flex-1 min-w-[200px]">
                                Channel name contains (case-insensitive)
                                <input
                                    value={placements[editingIdx]?.match || ''}
                                    onChange={e => patchEditing({ match: e.target.value })}
                                    placeholder="bein"
                                    dir="ltr"
                                    className="border border-gray-300 rounded px-2 py-1.5 text-sm"
                                />
                            </label>
                            <button
                                onClick={() => { setPlacements(list => list.filter((_, i) => i !== editingIdx)); setEditingIdx(-1); }}
                                className="text-xs text-red-600 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg px-3 py-2"
                            >
                                Remove rule
                            </button>
                            <p className="w-full text-[11px] text-gray-500">
                                Matches any channel whose name contains this text, so <span className="font-mono">bein</span> covers
                                every beIN variant. If several rules match, the longest one wins.
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="flex flex-col gap-1 text-xs text-gray-500">
                            From top: <span className="font-mono text-gray-800">{curTop}%</span>
                            <input type="range" min={0} max={60} step={0.5} value={curTop}
                                onChange={e => patchEditing({ topPct: Number(e.target.value) })} className="accent-green-600" />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-gray-500">
                            From right: <span className="font-mono text-gray-800">{curRight}%</span>
                            <input type="range" min={0} max={60} step={0.5} value={curRight}
                                onChange={e => patchEditing({ rightPct: Number(e.target.value) })} className="accent-green-600" />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-gray-500">
                            Size (height): <span className="font-mono text-gray-800">{curSize}%</span>
                            <input type="range" min={2} max={50} step={0.5} value={curSize}
                                onChange={e => patchEditing({ sizePct: Number(e.target.value) })} className="accent-green-600" />
                        </label>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input type="checkbox" checked={curBackdrop} onChange={e => patchEditing({ backdrop: e.target.checked })} className="accent-green-600" />
                        Opaque backdrop behind the logo (stops the channel&apos;s bug showing through a transparent PNG)
                    </label>
                </div>
                {(logoUrl || bottomText) && (
                    // 16:9 like the real player, so the % values preview truthfully.
                    <div className="relative rounded-lg bg-gray-900 aspect-video overflow-hidden flex items-center justify-center">
                        {logoUrl && (
                            <div className="absolute" style={{ top: `${curTop}%`, right: `${curRight}%`, height: `${curSize}%` }}>
                                <div className={`h-full ${curBackdrop ? 'bg-black p-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.5)]' : ''}`}>
                                    <img src={logoUrl} alt="logo preview" className="h-full w-auto object-contain" />
                                </div>
                            </div>
                        )}
                        {bottomText && <div className="absolute bottom-[12%] inset-x-0 px-3 text-center"><span className="text-white text-sm font-black tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]" style={{ fontFamily: 'var(--font-player-caption)' }} dir="auto">{bottomText}</span></div>}
                        <span className="text-gray-600 text-xs">
                            preview — {editingIdx >= 0 ? (placements[editingIdx]?.match || '(unnamed rule)') : 'default'}
                        </span>
                    </div>
                )}
                <button
                    onClick={() => saveGlobal({
                        logoUrl: logoUrl.trim(),
                        bottomText: bottomText.trim(),
                        logoTopPct, logoRightPct, logoSizePct, logoBackdrop,
                        // Blank-named rules would match every channel, so drop them on save.
                        logoPlacements: placements.filter(r => r.match.trim()),
                    })}
                    className="bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg px-4 py-2"
                >
                    Save branding
                </button>
            </div>

            {/* SportsOnline (prog.txt) auto-channels toggle */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Auto channels (SportsOnline)</h3>
                        <p className="text-sm text-gray-600 mt-1">Automatically match each fixture to channels from the daily playlist when you haven't set servers for it by hand. Your per-match and default servers always take priority.</p>
                    </div>
                    <button
                        onClick={() => saveGlobal({ playlistEnabled: !(config?.playlistEnabled ?? true) })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${(config?.playlistEnabled ?? true) ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'}`}
                    >
                        {(config?.playlistEnabled ?? true) ? 'Enabled' : 'Disabled'}
                    </button>
                </div>
            </div>

            {/* Per-match servers */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Per-match servers</h3>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                </div>
                {matchesLoading ? (
                    <p className="text-sm text-gray-400">Loading matches…</p>
                ) : (
                    <div className="space-y-2">
                        <input
                            placeholder="ابحث عن مباراة / فريق / دوري…"
                            value={matchSearch}
                            onChange={(e) => setMatchSearch(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
                            dir="rtl"
                        />
                        <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                            {filteredMatches.length === 0 ? (
                                <p className="text-sm text-gray-400 p-3">No matches for this date / search.</p>
                            ) : (
                                filteredMatches.map(m => {
                                    const id = String(m['Match-id']);
                                    const home = m['Team-Right'] || {};
                                    const away = m['Team-Left'] || {};
                                    const hasServers = !!config.matchServers[id];
                                    const selected = id === selectedMatchId;
                                    const hg = home.Goal !== '' && home.Goal != null ? home.Goal : null;
                                    const ag = away.Goal !== '' && away.Goal != null ? away.Goal : null;
                                    const hasScore = hg != null || ag != null;
                                    const time = rawKickoff(m);
                                    const status = m['Match-Status'] || 'لم تبدأ';
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => selectMatch(id)}
                                            className={`w-full flex flex-col gap-0.5 px-3 py-2 transition-colors ${selected ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                                            dir="rtl"
                                        >
                                            <div className="flex items-center gap-2 w-full">
                                                <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                                                    <span className="font-bold text-xs text-gray-800 truncate">{home.Name || 'فريق'}</span>
                                                    <PickLogo src={home.Logo} alt={home.Name || ''} />
                                                </div>
                                                <div className="flex flex-col items-center shrink-0 w-16 gap-0.5">
                                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${statusPillClass(status)}`}>{status}</span>
                                                    <span className="text-[11px] font-black text-gray-900" dir="ltr">{hasScore ? `${ag ?? 0} - ${hg ?? 0}` : (time || '—')}</span>
                                                    {hasScore && time && <span className="text-[8px] text-gray-400" dir="ltr">{time}</span>}
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                    <PickLogo src={away.Logo} alt={away.Name || ''} />
                                                    <span className="font-bold text-xs text-gray-800 truncate">{away.Name || 'فريق'}</span>
                                                </div>
                                                {hasServers && <span className="text-emerald-600 text-sm shrink-0" title="Has custom servers">●</span>}
                                                {selected && <span className="text-emerald-700 text-[10px] font-bold shrink-0">محدد</span>}
                                            </div>
                                            <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400">
                                                {m['Cup-Logo'] && <img src={m['Cup-Logo']} alt="" className="w-3 h-3 object-contain" />}
                                                <span className="truncate">{m['Cup-Name'] || '—'}</span>
                                                <span className="text-gray-300">· #{id}</span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
                {selectedMatchId && (
                    <div className="space-y-3 border-t border-gray-100 pt-3">
                        <FaborImporter onImport={(s) => setMatchDraft(prev => [...prev, ...s])} />
                        <ServerListEditor servers={matchDraft} onChange={setMatchDraft} />
                        <div className="flex gap-2">
                            <button onClick={saveMatchServers} className="bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg px-4 py-2">
                                Save match servers
                            </button>
                            {config.matchServers[selectedMatchId] && (
                                <button onClick={() => clearMatchServers(selectedMatchId)} className="text-sm text-red-600 hover:underline px-2">
                                    Clear override (use defaults)
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Active per-match configs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Matches with custom servers</h3>
                {Object.keys(config.matchServers).length === 0 ? (
                    <p className="text-sm text-gray-400">None — all matches use the default servers.</p>
                ) : (
                    <ul className="text-sm space-y-1">
                        {Object.entries(config.matchServers).map(([id, servers]) => (
                            <li key={id} className="flex justify-between items-center border-t border-gray-100 py-1.5">
                                <span className="text-gray-700">
                                    #{id}: {servers.map(s => `${s.flag || ''} ${s.label}`.trim()).join(' · ')}
                                </span>
                                <div className="space-x-3">
                                    <button onClick={() => selectMatch(id)} className="text-green-700 hover:underline">Edit</button>
                                    <button onClick={() => clearMatchServers(id)} className="text-red-600 hover:underline">Clear</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

export default LiveTab;
