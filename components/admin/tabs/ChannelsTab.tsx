import React, { useEffect, useMemo, useState } from 'react';
import {
    getAdminChannels, saveAdminChannels, AdminApiError,
    type AdminChannelEntry, type AdminChannelServer,
} from '../../../services/adminApi';
import { CHANNELS } from '../../../constants/channels';

interface Props {
    onUnauthorized: () => void;
}

const newChannel = (): AdminChannelEntry => ({
    id: `ch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: '', logo: '', url: '', servers: [],
});

// The bundled default list, used to seed the store the first time (before anything is saved).
const seedFromDefaults = (): AdminChannelEntry[] =>
    (CHANNELS as any[]).map((c, i) => ({
        id: String(c.id || `ch-seed-${i}`),
        name: String(c.name || ''),
        logo: String(c.logo || ''),
        url: String(c.url || ''),
        servers: Array.isArray(c.servers) ? c.servers.map((s: any) => ({ name: String(s.name || ''), url: String(s.url || '') })) : [],
    }));

const Logo = ({ src }: { src: string }) => {
    const [broken, setBroken] = useState(false);
    if (!src || broken) return <span className="w-8 h-8 inline-flex items-center justify-center text-[9px] text-gray-300 bg-gray-100 rounded">?</span>;
    return <img src={src} alt="" className="w-8 h-8 object-contain" onError={() => setBroken(true)} />;
};

function ChannelsTab({ onUnauthorized }: Props) {
    const [channels, setChannels] = useState<AdminChannelEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [dirty, setDirty] = useState(false);
    const [seeded, setSeeded] = useState(false);
    const [search, setSearch] = useState('');
    const [openId, setOpenId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [savedMsg, setSavedMsg] = useState('');

    const handleErr = (e: unknown, fallback: string) => {
        if (e instanceof AdminApiError && e.status === 401) return onUnauthorized();
        setError(e instanceof Error ? e.message : fallback);
    };
    const flash = (m: string) => { setSavedMsg(m); setError(''); setTimeout(() => setSavedMsg(''), 2500); };

    useEffect(() => {
        let cancelled = false;
        getAdminChannels()
            .then(list => {
                if (cancelled) return;
                if (list && list.length > 0) {
                    setChannels(list);
                } else {
                    // Nothing stored yet — load the bundled defaults so the operator can review & save.
                    setChannels(seedFromDefaults());
                    setSeeded(true);
                    setDirty(true);
                }
            })
            .catch(e => { if (!cancelled) handleErr(e, 'Failed to load channels'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return channels;
        return channels.filter(c => `${c.name} ${c.url} ${c.id}`.toLowerCase().includes(q));
    }, [channels, search]);

    const update = (id: string, patch: Partial<AdminChannelEntry>) => {
        setChannels(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
        setDirty(true);
    };
    const remove = (id: string) => { setChannels(prev => prev.filter(c => c.id !== id)); setDirty(true); };
    const add = () => { const c = newChannel(); setChannels(prev => [c, ...prev]); setOpenId(c.id); setDirty(true); };

    const setServers = (id: string, servers: AdminChannelServer[]) => update(id, { servers });

    const save = async () => {
        try {
            const clean = channels.filter(c => c.name.trim());
            const saved = await saveAdminChannels(clean);
            setChannels(saved);
            setDirty(false);
            setSeeded(false);
            flash(`Saved ${saved.length} channels ✓`);
        } catch (e) { handleErr(e, 'Failed to save channels'); }
    };

    const input = 'border border-gray-300 rounded px-2 py-1.5 text-sm';

    if (loading) return <p className="text-sm text-gray-400">Loading channels…</p>;

    return (
        <div className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">{error}</div>}
            {savedMsg && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2">{savedMsg}</div>}
            {seeded && <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg px-4 py-2">These are the built-in default channels. Review and click <b>Save all</b> to store them (then they become editable).</div>}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Channels ({channels.length})</h3>
                        <p className="text-sm text-gray-600 mt-1">Name, logo, main link and the per-channel server list. {dirty && <span className="text-amber-600 font-semibold">Unsaved changes.</span>}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={add} className="text-xs bg-gray-800 hover:bg-gray-900 text-white rounded px-3 py-2">+ Add channel</button>
                        <button onClick={save} disabled={!dirty} className="text-sm bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-lg px-4 py-2">Save all</button>
                    </div>
                </div>
                <input placeholder="Search channels…" value={search} onChange={e => setSearch(e.target.value)} className={`${input} w-full`} dir="ltr" />

                <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-100">
                    {filtered.length === 0 ? (
                        <p className="text-sm text-gray-400 p-3">No channels.</p>
                    ) : filtered.map(ch => (
                        <div key={ch.id} className="p-3">
                            <div className="flex items-center gap-2">
                                <Logo src={ch.logo} />
                                <input value={ch.name} onChange={e => update(ch.id, { name: e.target.value })} placeholder="Channel name" className={`${input} flex-1 min-w-0`} />
                                <button onClick={() => setOpenId(openId === ch.id ? null : ch.id)} className="text-xs bg-gray-100 hover:bg-gray-200 rounded px-2 py-1.5 whitespace-nowrap">
                                    Servers ({ch.servers.length})
                                </button>
                                <button onClick={() => remove(ch.id)} className="text-xs text-red-600 hover:underline px-1">Delete</button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                <input value={ch.logo} onChange={e => update(ch.id, { logo: e.target.value })} placeholder="Logo URL" dir="ltr" className={`${input} font-mono text-xs`} />
                                <input value={ch.url} onChange={e => update(ch.id, { url: e.target.value })} placeholder="Main link (.m3u8 / page)" dir="ltr" className={`${input} font-mono text-xs`} />
                            </div>
                            {openId === ch.id && (
                                <div className="mt-2 pl-2 border-l-2 border-emerald-200 space-y-1.5">
                                    {ch.servers.length === 0 && <p className="text-xs text-gray-400">No servers.</p>}
                                    {ch.servers.map((s, i) => (
                                        <div key={i} className="flex items-center gap-1.5">
                                            <input value={s.name} onChange={e => setServers(ch.id, ch.servers.map((x, xi) => xi === i ? { ...x, name: e.target.value } : x))} placeholder="Server label" className={`${input} text-xs w-40`} />
                                            <input value={s.url} onChange={e => setServers(ch.id, ch.servers.map((x, xi) => xi === i ? { ...x, url: e.target.value } : x))} placeholder="Server URL" dir="ltr" className={`${input} text-xs flex-1 min-w-0 font-mono`} />
                                            <button onClick={() => setServers(ch.id, ch.servers.filter((_, xi) => xi !== i))} className="text-red-600 text-xs px-1">✕</button>
                                        </div>
                                    ))}
                                    <button onClick={() => setServers(ch.id, [...ch.servers, { name: '', url: '' }])} className="text-xs text-emerald-700 hover:underline">+ Add server</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <button onClick={save} disabled={!dirty} className="text-sm bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-lg px-4 py-2">Save all</button>
            </div>
        </div>
    );
}

export default ChannelsTab;
