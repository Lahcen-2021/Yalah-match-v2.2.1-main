
import React, { useState, useEffect, useRef, memo } from 'react';

// --- Global Types ---
declare global {
    interface Window {
        Hls: any;
        videojs: any;
        Clappr: any;
    }
}

// --- On-demand video library loader ---
// hls.js + video.js + their CSS are ~540 KB that ONLY the stream player needs, yet they used to
// load eagerly from index.html on every page (including the match list, which has no player).
// Inject them the first time a player mounts instead. Each player below already polls for its
// global (window.Hls / window.videojs), so it starts as soon as the script finishes — callers
// can fire-and-forget. The promise is a singleton so the scripts are injected at most once.
let videoLibsPromise: Promise<void> | null = null;

const injectScript = (src: string): Promise<void> => new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => resolve(); // players degrade gracefully if a lib fails to load
    document.head.appendChild(s);
});

const loadVideoLibs = (): Promise<void> => {
    if (videoLibsPromise) return videoLibsPromise;
    if (typeof document === 'undefined') return Promise.resolve();
    if (!document.querySelector('link[href="https://vjs.zencdn.net/8.10.0/video-js.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://vjs.zencdn.net/8.10.0/video-js.css';
        document.head.appendChild(link);
    }
    videoLibsPromise = Promise.all([
        injectScript('https://cdn.jsdelivr.net/npm/hls.js@1'),
        injectScript('https://vjs.zencdn.net/8.10.0/video.min.js'),
    ]).then(() => undefined);
    return videoLibsPromise;
};

// --- Error Reporting Utility ---
const reportPlaybackError = (data: {
    player: 'Native' | 'Hls.js' | 'Video.js';
    url: string;
    errorType: string;
    errorCode?: string | number;
    message: string;
    retryCount?: number;
}) => {
    // Avoid circular structures in logging by creating a safe copy
    const safeData = {
        player: data.player,
        url: data.url,
        errorType: data.errorType,
        errorCode: data.errorCode,
        message: typeof data.message === 'string' ? data.message : 'Unknown Video Error',
        retryCount: data.retryCount
    };
    
    console.groupCollapsed(`%c[Stream Error Report] ${safeData.player}`, 'color: red; font-weight: bold;');
    console.table(safeData);
    console.groupEnd();
};

// --- Dynamic stream source ---
// Admin-configured servers may point at /api/stream, which answers with a short-lived
// {stream} URL rather than the media itself. All three players below carried their own
// copy of this effect (10s, 15s and 15s intervals). One implementation now serves them:
//
//  - 60s instead of 10-15s. The refresh exists to renew a token, not to follow the
//    broadcast, so four to six requests per minute per open player bought nothing.
//  - Paused while the tab is hidden, and refreshed immediately on return, so a
//    backgrounded stream stops issuing requests instead of polling forever.
//
// `src` values that are already a media URL skip the whole thing.
const useDynamicStreamSrc = (src: string) => {
    const [dynamicSrc, setDynamicSrc] = useState<string | null>(() =>
        src.includes('/api/stream') ? null : src
    );
    const [streamError, setStreamError] = useState<string | null>(null);

    useEffect(() => {
        if (!src.includes('/api/stream')) {
            setDynamicSrc(src);
            return;
        }

        let isMounted = true;

        const fetchStream = async () => {
            try {
                const res = await fetch(src);
                if (!res.ok) throw new Error(`Stream metadata fetch failed: ${res.status}`);
                const data = await res.json();
                if (data.stream && isMounted) {
                    setDynamicSrc(data.stream);
                    setStreamError(null);
                }
            } catch (e) {
                console.warn("Error fetching dynamic stream:", e);
                if (isMounted) setStreamError("تعذر جلب رابط البث.");
            }
        };

        fetchStream();
        const refreshTimer = setInterval(() => { if (!document.hidden) fetchStream(); }, 60000);
        const onVisible = () => { if (!document.hidden) fetchStream(); };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            isMounted = false;
            clearInterval(refreshTimer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [src]);

    return { dynamicSrc, streamError };
};

// --- HLS Player Component ---
export const InlinePlayer = memo(({ src, autoPlay = true, className = "w-full h-full", onError, hideNativeFullscreen }: { src: string, autoPlay?: boolean, className?: string, onError?: () => void, hideNativeFullscreen?: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { dynamicSrc, streamError } = useDynamicStreamSrc(src);

    // Detect if source is HLS stream or Embed
    const isStream = (src.includes('.m3u8') || src.includes('/api/hls')) || src.includes('.ts') || src.includes('/api/stream');
    
    const [isLoading, setIsLoading] = useState(() => isStream);
    // A failed /api/stream lookup and this player's own playback errors share one
    // display slot; deriving beats mirroring the hook's error into local state.
    const [ownError, setOwnError] = useState<string | null>(null);
    const error = ownError ?? streamError;
    const [reloadTrigger, setReloadTrigger] = useState(0);
    const [forceHlsJs, setForceHlsJs] = useState(false);
    const retryCountRef = useRef(0);
    const hlsRef = useRef<any>(null);
    const MAX_RETRIES = 5; 

    const handleRetry = () => {
        setIsLoading(true);
        setOwnError(null);
        retryCountRef.current = 0;
        setForceHlsJs(false);
        setReloadTrigger(prev => prev + 1);
    };

    useEffect(() => {
        let isMounted = true;
        if (!isStream || !dynamicSrc) {
            return;
        }

        loadVideoLibs(); // kick off hls.js load; the window.Hls poll below picks it up when ready

        const video = videoRef.current;
        if (!video) return;

        // Autoplay is only permitted while muted, so start muted for a NEW source. Set on
        // the element rather than as a React prop, so an unmute by the viewer sticks
        // instead of being reverted by the next render.
        if (autoPlay) video.muted = true;

        const onVideoReady = () => {
            if (isMounted) {
                setIsLoading(false);
                setOwnError(null);
            }
        };

        const onVideoError = () => {
            if (isMounted) {
                setOwnError("حدث خطأ أثناء تشغيل الفيديو. يرجى المحاولة مرة أخرى.");
                setIsLoading(false);
                if (onError) onError();
                
                reportPlaybackError({
                    player: forceHlsJs || !video.canPlayType('application/vnd.apple.mpegurl') ? 'Hls.js' : 'Native',
                    url: dynamicSrc,
                    errorType: 'SourceError',
                    message: "Playback failed"
                });
            }
        };

        if (video.canPlayType('application/vnd.apple.mpegurl') && !forceHlsJs) {
            video.src = dynamicSrc;
            video.addEventListener('loadedmetadata', onVideoReady);
            video.addEventListener('error', onVideoError);
            if (autoPlay) video.play().catch(() => {});
        } else if (window.Hls) {
            if (hlsRef.current) hlsRef.current.destroy();
            
            const hls = new window.Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 60,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                manifestLoadingMaxRetry: 5,
                levelLoadingMaxRetry: 5
            });
            hlsRef.current = hls;

            hls.loadSource(dynamicSrc);
            hls.attachMedia(video);
            
            hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                if (isMounted) {
                    onVideoReady();
                    if (autoPlay) video.play().catch(() => {});
                }
            });

            hls.on(window.Hls.Events.ERROR, (_: any, data: any) => {
                if (data.fatal) {
                    switch (data.type) {
                        case window.Hls.ErrorTypes.NETWORK_ERROR:
                            if (retryCountRef.current < MAX_RETRIES) {
                                retryCountRef.current++;
                                hls.startLoad();
                            } else if (isMounted) {
                                onVideoError();
                            }
                            break;
                        case window.Hls.ErrorTypes.MEDIA_ERROR:
                            hls.recoverMediaError();
                            break;
                        default:
                            if (isMounted) onVideoError();
                            break;
                    }
                }
            });
        } else {
             const checkInterval = setInterval(() => {
                if (window.Hls && isMounted) {
                    clearInterval(checkInterval);
                    setReloadTrigger(prev => prev + 1);
                }
            }, 500);
            return () => clearInterval(checkInterval);
        }

        return () => {
            isMounted = false;
            if (video) {
                video.removeEventListener('loadedmetadata', onVideoReady);
                video.removeEventListener('error', onVideoError);
                try {
                    video.pause();
                    video.src = "";
                    video.load();
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
            if (hlsRef.current) {
                try {
                    hlsRef.current.detachMedia();
                    hlsRef.current.destroy();
                } catch (e) {
                    // Ignore cleanup errors
                }
                hlsRef.current = null;
            }
        };
    }, [dynamicSrc, autoPlay, isStream, reloadTrigger, forceHlsJs, onError]);

    if (!isStream) {
        return (
            <iframe
                src={src}
                className={className}
                frameBorder="0"
                // Fullscreen IS permitted. Blocking it left the embed's own fullscreen
                // button doing nothing at all. Overlays are still kept: useWrapperFullscreen
                // redirects a descendant's fullscreen onto the wrapper that holds them.
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                // Sandboxed: the embed keeps what a video player needs (its own scripts,
                // its own origin, casting) but LOSES the two capabilities stream hosts
                // abuse — `allow-top-navigation` (silently redirecting the whole tab) and
                // `allow-popups` (popunders). streamSanitizer's ad-host blocklist is a
                // denylist and only catches hosts already known; this is the structural
                // control that does not need to know the host. If a provider ever needs
                // popups to play, that is the token to add back — deliberately, per host.
                sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                // Don't leak the match page URL (teams, date) to the stream host.
                referrerPolicy="no-referrer"
            />
        );
    }

    return (
        <div className={`relative bg-black overflow-hidden shadow-2xl ${className}`}>
            <video
                ref={videoRef}
                className="w-full h-full"
                controls
                // The browser's native fullscreen only shows the <video> element itself, dropping
                // our logo/text/ad overlays which are siblings — steer viewers to the player's own
                // fullscreen button (LiveStreamHub) instead, which fullscreens the whole wrapper.
                controlsList={hideNativeFullscreen ? 'nofullscreen' : undefined}
                playsInline
                // NOT `muted={autoPlay}`: as a controlled prop React re-asserts muted on every
                // render, so the moment anything re-rendered this component the viewer's unmute
                // was silently undone and the audio could never be turned up. Autoplay only
                // needs muted to be true when playback STARTS, so it's set once on the element
                // (see the ref effect) and left alone afterwards.
                poster="https://static.vecteezy.com/system/resources/previews/000/550/535/original/soccer-stadium-field-with-bright-lights-vector.jpg"
            />
            
            {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-white font-bold animate-pulse text-sm">جاري جلب البث...</p>
                </div>
            )}
            
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 p-4 text-center">
                    <p className="text-white mb-4 font-bold text-sm">{error}</p>
                    <button 
                        onClick={handleRetry}
                        className="bg-emerald-600 text-white px-6 py-2 rounded-full font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/30 text-sm"
                    >
                        إعادة المحاولة
                    </button>
                    {!forceHlsJs && (
                        <button 
                            onClick={() => setForceHlsJs(true)}
                            className="text-gray-400 mt-4 text-xs hover:text-white transition-colors"
                        >
                            هل لا يعمل؟ جرب مشغل Hls.js
                        </button>
                    )}
                </div>
            )}
        </div>
    );
});

// --- Video.js Player Component ---
export const VideoJSPlayer = memo(({ src, poster, className, onError, disableFullscreen }: { src: string, poster?: string, className?: string, onError?: () => void, disableFullscreen?: boolean }) => {
    const videoRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const checkIntervalRef = useRef<any>(null);

    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;

        loadVideoLibs(); // kick off video.js load; the window.videojs poll below picks it up when ready

        const initPlayer = () => {
            if (!window.videojs || !videoRef.current || !isMounted.current) return;

            if (!playerRef.current) {
                // The Video.js player needs to be _inside_ the component el for React 18 Strict Mode.
                const videoElement = document.createElement("video");
                videoElement.classList.add('video-js', 'vjs-big-play-centered', 'vjs-theme-city');
                videoRef.current.appendChild(videoElement);

                try {
                    const player = playerRef.current = window.videojs(videoElement, {
                        autoplay: true,
                        controls: true,
                        responsive: true,
                        fluid: true,
                        noReferrer: true,
                        // Hide Video.js's own fullscreen button when our wrapper owns fullscreen —
                        // its native fullscreen covers only the video and drops our overlays.
                        ...(disableFullscreen ? { controlBar: { fullscreenToggle: false } } : {}),
                        sources: [{ src, type: (src.includes('.m3u8') || src.includes('/api/hls')) ? 'application/x-mpegURL' : 'video/mp4' }],
                        poster: poster || "https://static.vecteezy.com/system/resources/previews/000/550/535/original/soccer-stadium-field-with-bright-lights-vector.jpg",
                        playbackRates: [1],
                        html5: {
                            vhs: {
                                overrideNative: true
                            },
                        }
                    }, () => {
                        if (!isMounted.current && player) {
                            player.dispose();
                            playerRef.current = null;
                        }
                    });

                    player.on('error', () => {
                        if (isMounted.current && onError) onError();
                        const error = player.error();
                        reportPlaybackError({
                            player: 'Video.js',
                            url: src,
                            errorType: 'PlaybackError',
                            message: typeof error?.message === 'string' ? error.message : 'Unknown Video.js error'
                        });
                    });
                } catch (err) {
                    console.error("Video.js initialization failed:", err);
                }
            } else {
                // Update existing player with new source
                const player = playerRef.current;
                player.src({ src, type: (src.includes('.m3u8') || src.includes('/api/hls')) ? 'application/x-mpegURL' : 'video/mp4' });
                if (poster) {
                    player.poster(poster);
                }
                player.play().catch(() => {});
            }
        };

        const initTimeout = setTimeout(() => {
            if (!isMounted.current || !videoRef.current) return;
            
            if (window.videojs) {
                initPlayer();
            } else {
                if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
                checkIntervalRef.current = setInterval(() => {
                    if (window.videojs && isMounted.current) {
                        clearInterval(checkIntervalRef.current);
                        initPlayer();
                    }
                }, 500);
            }
        }, 50);

        return () => {
            isMounted.current = false;
            clearTimeout(initTimeout);
            if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
            // DO NOT DISPOSE HERE, dispose only on unmount via the other useEffect
        };
    }, [src, poster, onError, disableFullscreen]);

    // Dispose the Video.js player when the functional component unmounts
    useEffect(() => {
        return () => {
            if (playerRef.current && !playerRef.current.isDisposed()) {
                try {
                    playerRef.current.dispose();
                } catch (e) {
                    console.warn("Video.js disposal error:", e);
                }
                playerRef.current = null;
            }
        };
    }, []);

    return (
        <div className={`overflow-hidden shadow-2xl ${className}`} dir="ltr" data-vjs-player>
            <div ref={videoRef} className="w-full h-full" />
        </div>
    );
});

// --- Clappr Player Component ---
export const ClapprPlayer = memo(({ src, className = "w-full h-full", onError }: { src: string, className?: string, onError?: () => void }) => {
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const clapprInstance = useRef<any>(null);
    const { dynamicSrc, streamError } = useDynamicStreamSrc(src);
    const [isLoading, setIsLoading] = useState(true);
    // A failed /api/stream lookup and this player's own playback errors share one
    // display slot; deriving beats mirroring the hook's error into local state.
    const [ownError, setOwnError] = useState<string | null>(null);
    const error = ownError ?? streamError;

    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);


    useEffect(() => {
        let isActuallyMounted = true; 
        if (!dynamicSrc || !playerContainerRef.current) return;

        const clapprScriptUrl = "https://cdn.jsdelivr.net/npm/clappr@0.3.13/dist/clappr.min.js";

        const initPlayer = () => {
            if (!window.Clappr || !window.Clappr.Player || !playerContainerRef.current || !isActuallyMounted) return;
            
            if (clapprInstance.current) {
                clapprInstance.current.destroy();
            }

            try {
                const containerId = `clappr-container-${Math.random().toString(36).slice(2, 11)}`;
                if (playerContainerRef.current) {
                    playerContainerRef.current.id = containerId;
                }

                // Small delay to ensure ID is set in DOM
                setTimeout(() => {
                    if (!playerContainerRef.current || !isActuallyMounted) return;
                    
                    clapprInstance.current = new window.Clappr.Player({
                        source: dynamicSrc,
                        parentId: `#${containerId}`,
                        autoPlay: true,
                        width: "100%",
                        height: "100%",
                        mediacontrol: { seekbar: "#059669", buttons: "#059669" },
                        events: {
                            onReady: () => {
                                if (isActuallyMounted) setIsLoading(false);
                                if (clapprInstance.current) {
                                    const playPromise = clapprInstance.current.play();
                                    if (playPromise && typeof playPromise.catch === 'function') {
                                        playPromise.catch((err: any) => console.log("Auto-play prevented or failed:", err));
                                    }
                                }
                            },
                            onError: (e: any) => {
                                console.error("Clappr Playback Error:", e);
                                if (isActuallyMounted) {
                                    setOwnError("حدث خطأ في مشغل Clappr. جرب مشغل آخر.");
                                    if (onError) onError();
                                }
                            }
                        }
                    });
                }, 50);
            } catch (err) {
                console.error("Error creating Clappr instance:", err);
                if (isActuallyMounted) {
                    setOwnError("فشل في تشغيل Clappr.");
                    setIsLoading(false);
                }
            }
        };

        if (window.Clappr) {
            initPlayer();
        } else {
            let script = document.querySelector(`script[src="${clapprScriptUrl}"]`) as HTMLScriptElement;
            if (!script) {
                script = document.createElement('script');
                script.src = clapprScriptUrl;
                script.async = true;
                script.crossOrigin = "anonymous";
                document.body.appendChild(script);
            }
            script.addEventListener('load', initPlayer);
            script.addEventListener('error', () => {
                if (isActuallyMounted) {
                    setOwnError("فشل تحميل مشغل Clappr.");
                    setIsLoading(false);
                }
            });
        }

        return () => {
            isActuallyMounted = false;
            if (clapprInstance.current) {
                clapprInstance.current.destroy();
                clapprInstance.current = null;
            }
        };
    }, [dynamicSrc, onError]);

    return (
        <div className={`relative bg-black overflow-hidden shadow-2xl ${className}`}>
            <div ref={playerContainerRef} className="w-full h-full" />
            {isLoading && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 p-4 text-center">
                    <p className="text-white mb-4">{error}</p>
                </div>
            )}
        </div>
    );
});

// --- Plyr Player Component ---
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

export const PlyrPlayer = memo(({ src, autoPlay = true, className = "w-full h-full", poster, onError, disableFullscreen }: { src: string, autoPlay?: boolean, className?: string, poster?: string, onError?: () => void, disableFullscreen?: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const plyrRef = useRef<Plyr | null>(null);
    const { dynamicSrc, streamError } = useDynamicStreamSrc(src);
    const [isLoading, setIsLoading] = useState(true);
    // A failed /api/stream lookup and this player's own playback errors share one
    // display slot; deriving beats mirroring the hook's error into local state.
    const [ownError, setOwnError] = useState<string | null>(null);
    const error = ownError ?? streamError;

    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);


    useEffect(() => {
        if (!dynamicSrc || !videoRef.current) return;

        let hls: any = null;
        let cancelled = false;
        const video = videoRef.current;

        plyrRef.current = new Plyr(video, {
            autoplay: autoPlay,
            muted: autoPlay,
            // When our wrapper owns fullscreen (LiveStreamHub), hide Plyr's own fullscreen button:
            // its native fullscreen only covers the <video>/.plyr element and drops our logo/text/ad
            // overlays. Our button fullscreens the whole wrapper instead.
            fullscreen: disableFullscreen ? { enabled: false } : { enabled: true, fallback: true, iosNative: false },
        });

        plyrRef.current.on('ready', () => {
            if (isMounted.current) setIsLoading(false);
        });

        const needsHls = (dynamicSrc.includes('.m3u8') || dynamicSrc.includes('.ts') || dynamicSrc.includes('/api/hls'))
            && !video.canPlayType('application/vnd.apple.mpegurl');

        const attachSource = () => {
            if (cancelled) return;
            if (dynamicSrc.includes('.m3u8') || dynamicSrc.includes('.ts')) {
                if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = dynamicSrc;
                } else if (window.Hls && window.Hls.isSupported()) {
                    hls = new window.Hls();
                    hls.loadSource(dynamicSrc);
                    hls.attachMedia(video);
                    hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                        if (isMounted.current) {
                            setIsLoading(false);
                            if (autoPlay) video.play().catch(() => {});
                        }
                    });
                    hls.on(window.Hls.Events.ERROR, (_: any, data: any) => {
                        if (data.fatal && isMounted.current) {
                            setOwnError("حدث خطأ أثناء تشغيل الفيديو.");
                            if (onError) onError();
                        }
                    });
                } else if (isMounted.current) {
                    setOwnError("المتصفح لا يدعم هذا النوع من الفيديو.");
                }
            } else {
                video.src = dynamicSrc;
            }
        };

        // hls.js is now loaded on demand, so wait for it before attaching an HLS source that
        // needs it; native-HLS and direct sources attach immediately.
        if (needsHls) loadVideoLibs().then(attachSource);
        else attachSource();

        return () => {
            cancelled = true;
            if (hls) {
                hls.destroy();
            }
            if (plyrRef.current) {
                plyrRef.current.destroy();
            }
        };
    }, [dynamicSrc, autoPlay, onError, disableFullscreen]);

    if (!(src.includes('.m3u8') || src.includes('/api/hls')) && !src.includes('.ts') && !src.includes('/api/stream') && !src.endsWith('.mp4')) {
        return (
            <iframe
                src={src}
                className={className}
                frameBorder="0"
                // Fullscreen IS permitted. Blocking it left the embed's own fullscreen
                // button doing nothing at all. Overlays are still kept: useWrapperFullscreen
                // redirects a descendant's fullscreen onto the wrapper that holds them.
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                // Sandboxed: the embed keeps what a video player needs (its own scripts,
                // its own origin, casting) but LOSES the two capabilities stream hosts
                // abuse — `allow-top-navigation` (silently redirecting the whole tab) and
                // `allow-popups` (popunders). streamSanitizer's ad-host blocklist is a
                // denylist and only catches hosts already known; this is the structural
                // control that does not need to know the host. If a provider ever needs
                // popups to play, that is the token to add back — deliberately, per host.
                sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
                // Don't leak the match page URL (teams, date) to the stream host.
                referrerPolicy="no-referrer"
            />
        );
    }

    return (
        <div className={`relative bg-black overflow-hidden shadow-2xl ${className}`} dir="ltr">
             <video ref={videoRef} playsInline poster={poster} className="w-full h-full"></video>
             
             {isLoading && !error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 p-4 text-center">
                    <p className="text-white mb-4">{error}</p>
                </div>
            )}
        </div>
    );
});
