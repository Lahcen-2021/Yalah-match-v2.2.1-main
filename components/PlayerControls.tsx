import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

// Our own play / volume / fullscreen cluster, drawn over the player.
//
// Deliberately bottom-RIGHT: the top-left corner is where stream providers put their own
// "click to unmute" prompt, and a button parked there swallows the click that would have
// unmuted the audio.
//
// The media buttons drive whatever <video> the active player mounted (Plyr, Video.js and
// the native player all render one). Iframe servers are cross-origin, so there is no video
// to reach into — those get the fullscreen button alone rather than dead controls.
export function PlayerControls({ wrapRef, isFullscreen, onToggleFullscreen }: {
    wrapRef: React.RefObject<HTMLElement | null>;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
}) {
    // Two handles on the same element: state drives rendering (are there controls to
    // show?), the ref is what we mutate through — the compiler treats state as immutable.
    const [video, setVideo] = useState<HTMLVideoElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(true);
    const [volume, setVolume] = useState(1);

    // Players mount their <video> asynchronously (hls.js, Plyr), and swapping server or
    // player type replaces it, so watch the subtree instead of looking only once.
    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const sync = () => setVideo(prev => {
            const found = wrap.querySelector('video');
            videoRef.current = found;
            return prev === found ? prev : found;
        });
        const observer = new MutationObserver(sync);
        observer.observe(wrap, { childList: true, subtree: true });
        // Off the effect body (rAF, not synchronous) so the first detection doesn't
        // cascade a render.
        const raf = requestAnimationFrame(sync);
        return () => { observer.disconnect(); cancelAnimationFrame(raf); };
    }, [wrapRef]);

    // Mirror the video's own state, so the buttons stay honest when something else changes
    // it — the player's native controls, a keyboard shortcut, autoplay being blocked.
    useEffect(() => {
        if (!video) return;
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        const onVolume = () => { setMuted(video.muted); setVolume(video.volume); };
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('volumechange', onVolume);
        // Seed from the element's current state off the effect body (rAF, not synchronous)
        // so the first read doesn't cascade a render.
        const raf = requestAnimationFrame(() => { onVolume(); setPlaying(!video.paused); });
        return () => {
            cancelAnimationFrame(raf);
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('volumechange', onVolume);
        };
    }, [video]);

    const togglePlay = useCallback(() => {
        const el = videoRef.current;
        if (!el) return;
        if (el.paused) el.play().catch(() => {});
        else el.pause();
    }, []);

    const toggleMute = useCallback(() => {
        const el = videoRef.current;
        if (!el) return;
        // Unmuting at zero volume would look broken, so give it an audible level.
        if (el.muted && el.volume === 0) el.volume = 1;
        el.muted = !el.muted;
    }, []);

    const changeVolume = useCallback((value: number) => {
        const el = videoRef.current;
        if (!el) return;
        el.volume = value;
        // Any deliberate volume nudge implies "I want to hear this".
        el.muted = value === 0;
    }, []);

    const btn = 'p-2 rounded-lg bg-black/45 hover:bg-black/70 text-white/90 hover:text-white transition-colors backdrop-blur-sm';

    return (
        <div className="absolute bottom-3 right-3 z-[10000003] flex items-center gap-1.5">
            {video && (
                <>
                    <button onClick={togglePlay} className={btn}
                        title={playing ? 'إيقاف مؤقت' : 'تشغيل'} aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}>
                        {playing ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <div className="flex items-center gap-1.5 rounded-lg bg-black/45 backdrop-blur-sm pr-2 group">
                        <button onClick={toggleMute} className="p-2 text-white/90 hover:text-white transition-colors"
                            title={muted ? 'إلغاء الكتم' : 'كتم الصوت'} aria-label={muted ? 'إلغاء الكتم' : 'كتم الصوت'}>
                            {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                        <input
                            type="range" min={0} max={1} step={0.05}
                            value={muted ? 0 : volume}
                            onChange={e => changeVolume(Number(e.target.value))}
                            aria-label="مستوى الصوت"
                            className="w-0 opacity-0 group-hover:w-20 group-hover:opacity-100 focus:w-20 focus:opacity-100 transition-all accent-emerald-500 cursor-pointer"
                        />
                    </div>
                </>
            )}
            <button onClick={onToggleFullscreen} className={btn}
                title={isFullscreen ? 'إنهاء وضع ملء الشاشة' : 'ملء الشاشة'}
                aria-label={isFullscreen ? 'إنهاء وضع ملء الشاشة' : 'ملء الشاشة'}>
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
        </div>
    );
}
