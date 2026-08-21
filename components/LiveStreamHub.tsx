import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, ExternalLink, WifiOff } from 'lucide-react';
import { Match, MatchStatus } from '../types';
import { fetchLiveStreamConfig, resolveLogoPlacement, LiveStreamConfig, LiveStreamServer, LiveOverlayAd } from '../services/api';
import { InlinePlayer, VideoJSPlayer, PlyrPlayer } from './Players';
import { cleanStreamUrl, isAdHost } from '../utils/streamSanitizer';
import { useWrapperFullscreen } from '../utils/useWrapperFullscreen';
import { PlayerControls } from './PlayerControls';

// Admin-managed live watch section (Fabor-style: server tabs + player), restyled to the
// Yalla Match light/emerald design. Servers are fully controlled from the /admin panel
// ("Live" tab) and can be imported from Fabor-TV there. When no servers are configured,
// the `fallback` node (the legacy channel-matching player) renders instead.
//
// Note: MatchDetailView already renders the green match-summary header right above the
// tab bar, so this section intentionally renders no score card of its own — an earlier
// version duplicated the banner.

const CONFIG_POLL_MS = 60000;

// Terminal-look "stream unavailable" panel (our take on the reference ERROR 204 screen).
const StreamErrorPanel: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
    <div className="w-full h-full min-h-[300px] bg-[#04140d] flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, #10b981 0px, #10b981 1px, transparent 1px, transparent 4px)' }} />
        <WifiOff className="w-8 h-8 text-emerald-500/60 mb-4" />
        <p className="font-mono text-2xl sm:text-3xl text-emerald-400 tracking-[0.3em] mb-4" dir="ltr">ERROR 204</p>
        <p className="font-mono text-[11px] sm:text-sm text-emerald-200/70 mb-1" dir="ltr">&gt; THIS CONTENT IS CURRENTLY UNAVAILABLE</p>
        <p className="text-xs text-white/50 font-bold mt-3">البث غير متوفر حالياً — جرّب سيرفراً آخر أو أعد المحاولة</p>
        <button
            onClick={onRetry}
            className="mt-5 px-5 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs font-black hover:bg-emerald-600/30 transition-colors flex items-center gap-2"
        >
            <RefreshCw size={13} /> إعادة المحاولة
        </button>
    </div>
);

// The operator's own promo banner, drawn over the player. Dismissible, and can
// auto-hide after N seconds. Cross-origin iframe ads can't be removed, but this
// puts YOUR ad on top of everything.
function OverlayAdBanner({ ad }: { ad: LiveOverlayAd }) {
    // `closed` resets when the operator swaps the ad because the call site keys
    // this component on imageUrl+closeAfterSec, remounting it. That replaces the
    // old setClosed(false)-inside-the-effect, which was a redundant render pass
    // and is flagged by react-hooks/set-state-in-effect.
    const [closed, setClosed] = useState(false);
    useEffect(() => {
        if (!ad.closeAfterSec || ad.closeAfterSec <= 0) return;
        const t = setTimeout(() => setClosed(true), ad.closeAfterSec * 1000);
        return () => clearTimeout(t);
    }, [ad.closeAfterSec]);

    if (closed || !ad.enabled || !ad.imageUrl) return null;

    const pos =
        ad.position === 'top' ? 'top-0 inset-x-0 justify-center' :
        ad.position === 'bottom-left' ? 'bottom-2 left-2' :
        ad.position === 'bottom-right' ? 'bottom-2 right-2' :
        'bottom-0 inset-x-0 justify-center';

    const img = (
        <img
            src={ad.imageUrl}
            alt="إعلان"
            className="max-h-20 sm:max-h-24 w-auto max-w-[92%] object-contain rounded-md shadow-lg"
        />
    );

    return (
        // z above Plyr's fullscreen layer (it puts .plyr at z-index 10000000) so the ad stays
        // visible when the player wrapper is fullscreened.
        <div className={`absolute ${pos} z-[10000002] flex p-2 pointer-events-none`}>
            <div className="relative pointer-events-auto">
                <button
                    onClick={(e) => { e.stopPropagation(); setClosed(true); }}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/70 text-white text-xs leading-none flex items-center justify-center hover:bg-black"
                    aria-label="إغلاق الإعلان"
                >×</button>
                {ad.linkUrl
                    ? <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer sponsored">{img}</a>
                    : img}
            </div>
        </div>
    );
}

// The operator's own logo (top-right) + promo caption (bottom) drawn over the
// player. Rendered over BOTH the admin-server player and the legacy fallback
// player, so the branding set in the admin Live tab shows on every match — not
// only ones that have watch servers configured.
function BrandingOverlay({ logoUrl, bottomText, logoTopPct, logoRightPct, logoSizePct, logoBackdrop }: {
    logoUrl?: string;
    bottomText?: string;
    logoTopPct?: number;
    logoRightPct?: number;
    logoSizePct?: number;
    logoBackdrop?: boolean;
}) {
    // Safety net for fullscreen. Our own button fullscreens the wrapper that holds both the
    // video and these overlays, so they ride along. But if anything else takes fullscreen —
    // a player control we didn't disable, a keyboard shortcut, a browser gesture — the
    // fullscreen element covers the screen and paints over overlays that live outside it,
    // so the branding just vanishes. Re-parenting into whatever element currently owns
    // fullscreen keeps the logo and caption on screen either way.
    const [fsHost, setFsHost] = useState<Element | null>(null);
    useEffect(() => {
        const onChange = () => {
            const el = document.fullscreenElement || (document as any).webkitFullscreenElement || null;
            // <video>/<iframe> can't host children, so there is nothing to portal into —
            // that's why native player fullscreen is disabled in favour of our own button.
            const tag = el?.tagName;
            setFsHost(el && tag !== 'VIDEO' && tag !== 'IFRAME' ? el : null);
        };
        document.addEventListener('fullscreenchange', onChange);
        document.addEventListener('webkitfullscreenchange', onChange);
        return () => {
            document.removeEventListener('fullscreenchange', onChange);
            document.removeEventListener('webkitfullscreenchange', onChange);
        };
    }, []);

    if (!logoUrl && !bottomText) return null;
    // Percentages, not pixels: the broadcaster's bug is burned into the video at a fixed
    // fraction of the frame, so only a % offset keeps our logo parked on it at every
    // player size (mobile, desktop, fullscreen). Inline styles because these come from
    // the admin at runtime — Tailwind can't generate arbitrary classes for dynamic values.
    const top = logoTopPct ?? 3;
    const right = logoRightPct ?? 8;
    const size = logoSizePct ?? 18;
    const content = (
        <>
            {logoUrl && (
                // Sits ON TOP of the broadcaster's own on-screen bug (ESPN/beIN/etc.), which is
                // burned into the stream and can't be removed — so we cover it instead.
                // z above Plyr's fullscreen layer (z-index 10000000) so it survives fullscreen.
                <div
                    className="absolute z-[10000001] pointer-events-none"
                    style={{ top: `${top}%`, right: `${right}%`, height: `${size}%` }}
                >
                    <div className={`h-full ${logoBackdrop
                        // Optional opaque plate, for fully hiding the broadcaster's bug
                        // behind a transparent logo. Off by default — the logo sits
                        // straight on the video.
                        ? 'bg-black p-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.5)]'
                        : ''}`}
                    >
                        <img
                            src={logoUrl}
                            alt=""
                            className={`h-full w-auto object-contain ${logoBackdrop ? '' : 'drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]'}`}
                        />
                    </div>
                </div>
            )}
            {bottomText && (
                // Raised above the player's control bar so it clears the bottom controls.
                <div className="absolute bottom-14 sm:bottom-16 inset-x-0 z-[10000001] pointer-events-none">
                    <div className="px-3 text-center">
                        <span
                            className="text-white text-base sm:text-xl font-black tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
                            style={{ fontFamily: 'var(--font-player-caption)' }}
                            dir="auto"
                        >
                            {bottomText}
                        </span>
                    </div>
                </div>
            )}
        </>
    );
    // In fullscreen the overlays must live INSIDE the fullscreen element, or the browser
    // paints that element over them and the branding disappears.
    return fsHost ? createPortal(content, fsHost) : content;
}

interface Props {
    match: Match;
    // Legacy channel-based player, rendered when no admin servers are configured.
    fallback: React.ReactNode;
}

const LiveStreamHub: React.FC<Props> = ({ match, fallback }) => {
    const [config, setConfig] = useState<LiveStreamConfig | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [activeServerId, setActiveServerId] = useState<string | null>(null);
    const [playerType, setPlayerType] = useState<'plyr' | 'default' | 'videojs'>('plyr');
    const [hlsFailed, setHlsFailed] = useState(false);
    // Bumping remounts the iframe/player (the reload button).
    const [reloadKey, setReloadKey] = useState(0);

    // Our own fullscreen toggle targets this wrapper (video/iframe + overlays together) so the
    // logo/text/ad stay visible in fullscreen — a player's own fullscreen button only takes
    // ITS element fullscreen, leaving sibling overlay divs behind.
    const { ref: playerWrapRef, isFullscreen, toggle: toggleFullscreen } = useWrapperFullscreen<HTMLDivElement>();

    useEffect(() => {
        let cancelled = false;
        const load = () => {
            fetchLiveStreamConfig(match.id, {
                home: match.teamA?.name,
                away: match.teamB?.name,
                date: match.utcDate,
            }).then(cfg => {
                if (cancelled) return;
                setConfig(cfg);
                setLoaded(true);
            });
        };
        load();
        const id = setInterval(() => { if (!document.hidden) load(); }, CONFIG_POLL_MS);
        return () => { cancelled = true; clearInterval(id); };
        // All four deps are primitives, so a re-created `match` object with the same
        // values compares equal and the 60s poll is not restarted on every render.
    }, [match.id, match.teamA?.name, match.teamB?.name, match.utcDate]);

    const servers = useMemo(() => (config?.enabled ? config.servers : []) || [], [config]);

    // If the admin removes the picked server from under us, this silently falls back
    // to the first server — no state reset needed.
    const activeServer: LiveStreamServer | null = useMemo(() => {
        if (servers.length === 0) return null;
        return servers.find(s => s.id === activeServerId) || servers[0];
    }, [servers, activeServerId]);

    const pickServer = (s: LiveStreamServer) => {
        setActiveServerId(s.id);
        setHlsFailed(false);
        setReloadKey(k => k + 1);
    };

    // Ad hygiene for whatever server is playing: strip tracker/redirect params and
    // refuse to load a URL that points at a known ad / popunder host.
    const safeUrl = useMemo(() => (activeServer ? cleanStreamUrl(activeServer.url) : ''), [activeServer]);
    const adBlocked = useMemo(() => !!safeUrl && isAdHost(safeUrl), [safeUrl]);

    // Shared by the admin-server player and the legacy fallback player, so branding looks
    // identical on both. Placement is resolved per channel: each broadcaster burns its bug
    // into a different corner, so one global position can only ever suit one of them.
    const brandingFor = (channelName?: string) => {
        const p = resolveLogoPlacement(config, channelName);
        return {
            logoUrl: config?.logoUrl,
            bottomText: config?.bottomText,
            logoTopPct: p.topPct,
            logoRightPct: p.rightPct,
            logoSizePct: p.sizePct,
            logoBackdrop: p.backdrop,
        };
    };

    if (!loaded) {
        return (
            <div className="w-full pt-3 sm:pt-4">
                <div className="w-full bg-gray-900 h-[300px] sm:h-auto sm:aspect-video animate-pulse" />
            </div>
        );
    }

    // No admin servers → legacy channel-based player. Still overlay the operator's
    // branding (logo + caption) so it shows on matches without configured servers.
    if (!activeServer) {
        // Inject the branding INTO the fallback player so it anchors to that player's
        // video box (top-right logo / bottom caption), not the whole tall control panel.
        // A render function, not a node: only the fallback player knows which channel the
        // viewer picked, and placement depends on that channel.
        const brandedFallback = (config?.logoUrl || config?.bottomText) && React.isValidElement(fallback)
            ? React.cloneElement(fallback as React.ReactElement<{ branding?: (channelName: string) => React.ReactNode }>, {
                  branding: (channelName: string) => <BrandingOverlay {...brandingFor(channelName)} />,
              })
            : fallback;
        return (
            <div className="w-full pt-3 sm:pt-4 bg-white">
                {brandedFallback}
            </div>
        );
    }

    const isLive = match.status === MatchStatus.LIVE || match.status === MatchStatus.HALF_TIME;

    return (
        <div className="w-full bg-white pt-3 sm:pt-4">
            {/* Server tabs — the AR1 / AR2 / FR / EN row from the reference, in our style */}
            <div className="mx-2 sm:mx-0 mb-3 bg-gray-50/80 border border-gray-100 rounded-2xl p-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar" dir="rtl">
                {servers.map(s => {
                    const active = s.id === activeServer.id;
                    return (
                        <button
                            key={s.id}
                            onClick={() => pickServer(s)}
                            className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all border ${
                                active
                                    ? 'bg-gradient-to-l from-emerald-600 to-teal-500 text-white border-emerald-600 shadow-md shadow-emerald-600/20 scale-[1.02]'
                                    : 'bg-white text-gray-500 border-gray-100 hover:border-emerald-200 hover:text-emerald-700'
                            }`}
                        >
                            {s.flag && <span className="text-sm leading-none">{s.flag}</span>}
                            {s.label}
                        </button>
                    );
                })}
            </div>

            {/* Player header: live badge + iframe controls */}
            <div className="mx-2 sm:mx-0 flex items-center justify-between mb-2">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isLive ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                    <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-red-600 animate-pulse' : 'bg-gray-400'}`}></span>
                    <span className={`text-[10px] font-black uppercase tracking-tight ${isLive ? 'text-red-700' : 'text-gray-500'}`}>
                        {isLive ? 'بث مباشر' : 'المشغل'}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => { setHlsFailed(false); setReloadKey(k => k + 1); }}
                        title="إعادة تحميل المشغل"
                        className="p-2 rounded-lg bg-gray-50 border border-gray-100 text-gray-500 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
                    >
                        <RefreshCw size={14} />
                    </button>
                    {activeServer.type === 'iframe' && (
                        <a
                            href={activeServer.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="فتح في نافذة جديدة"
                            className="p-2 rounded-lg bg-gray-50 border border-gray-100 text-gray-500 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
                        >
                            <ExternalLink size={14} />
                        </a>
                    )}
                </div>
            </div>

            {/* Player — our own fullscreen button (top-right, below) fullscreens THIS whole wrapper,
                so the video/iframe AND the logo/text/ad overlays go fullscreen together. Each
                player's own fullscreen button is disabled so nobody triggers the built-in path,
                which fullscreens only the <video> and drops our overlays. */}
            <div
                ref={playerWrapRef}
                className="yalla-live-player-wrap relative w-full bg-black h-[300px] sm:h-auto sm:aspect-video sm:rounded-2xl overflow-hidden sm:border sm:border-gray-100"
            >
                {config?.overlayAd?.enabled && (
                    // Keyed so a new ad (or a changed auto-close delay) remounts the
                    // banner and un-dismisses it, instead of resetting state in an effect.
                    <OverlayAdBanner
                        key={`${config.overlayAd.imageUrl}|${config.overlayAd.closeAfterSec ?? 0}`}
                        ad={config.overlayAd}
                    />
                )}
                {!(hlsFailed || adBlocked) && (
                    <BrandingOverlay {...brandingFor(activeServer.label)} />
                )}
                {/* Play / volume / fullscreen, bottom-right. Above the overlays' z so it stays
                    clickable in fullscreen. */}
                {!(hlsFailed || adBlocked) && (
                    <PlayerControls wrapRef={playerWrapRef} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />
                )}
                {hlsFailed || adBlocked ? (
                    <StreamErrorPanel onRetry={() => { setHlsFailed(false); setReloadKey(k => k + 1); }} />
                ) : activeServer.type === 'iframe' ? (
                    <iframe
                        key={`if-${activeServer.id}-${reloadKey}`}
                        src={safeUrl}
                        className="w-full h-full border-0"
                        // NOTE: intentionally NO `fullscreen` in `allow` and NO `allowFullScreen`.
                        // A cross-origin embed's own fullscreen button would take only the iframe
                        // fullscreen, dropping our logo/text/ad overlays (they live outside it).
                        // Blocking it forces fullscreen through our own button, which fullscreens
                        // the whole wrapper (iframe + overlays together) so the branding stays on.
                        allow="autoplay; encrypted-media; picture-in-picture"
                        // Sandboxed: keeps what a player needs, drops `allow-top-navigation`
                        // (tab-hijacking redirects) and `allow-popups` (popunders) — the two
                        // things stream hosts abuse. cleanStreamUrl + isAdHost above are a
                        // denylist of known-bad hosts; this holds for the ones not on it.
                        sandbox="allow-scripts allow-same-origin allow-presentation"
                        referrerPolicy="no-referrer"
                        title={`بث ${activeServer.label}`}
                    />
                ) : playerType === 'plyr' ? (
                    <PlyrPlayer key={`plyr-${activeServer.id}-${reloadKey}`} src={safeUrl} className="w-full h-full" disableFullscreen />
                ) : playerType === 'default' ? (
                    <InlinePlayer key={`inline-${activeServer.id}-${reloadKey}`} src={safeUrl} className="w-full h-full" onError={() => setHlsFailed(true)} hideNativeFullscreen />
                ) : (
                    <VideoJSPlayer key={`vjs-${activeServer.id}-${reloadKey}`} src={safeUrl} className="w-full h-full" disableFullscreen />
                )}
            </div>

            {/* Player engine selector — only meaningful for direct HLS sources */}
            {activeServer.type === 'hls' && (
                <div className="mx-2 sm:mx-0 mt-3 mb-1 flex items-center bg-gray-100/60 p-1 max-w-sm rounded-lg overflow-x-auto whitespace-nowrap no-scrollbar">
                    {([['plyr', 'مشغل بليير'], ['default', 'مشغل خارجي'], ['videojs', 'مشغل مدمج']] as const).map(([id, label]) => (
                        <button
                            key={id}
                            onClick={() => { setPlayerType(id); setHlsFailed(false); }}
                            className={`flex-1 min-w-[90px] px-3 py-2 text-[10px] font-black transition-all flex items-center justify-center gap-1.5 ${
                                playerType === id ? 'bg-white text-emerald-600 shadow-sm border border-gray-100 rounded-md' : 'text-gray-400 opacity-60'
                            }`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${playerType === id ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-gray-300'}`}></div>
                            {label}
                        </button>
                    ))}
                </div>
            )}

            <div className="h-3" />
        </div>
    );
};

export default React.memo(LiveStreamHub);
