import { useCallback, useEffect, useRef, useState } from 'react';

// Fullscreens a WRAPPER element rather than the video itself.
//
// A player's own fullscreen button takes only its own element fullscreen, which leaves
// sibling overlay divs (our logo, caption and ad banner) behind — they simply vanish for
// as long as fullscreen lasts. Pointing fullscreen at the wrapper that holds the video
// AND the overlays keeps them on screen together.
//
// Callers should also disable the player's native fullscreen button, so the only route
// into fullscreen is the one that keeps the branding.
export function useWrapperFullscreen<T extends HTMLElement = HTMLDivElement>() {
    const ref = useRef<T>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        // Safari fires the webkit-prefixed event only, so listen for both.
        const onChange = () => {
            const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
            setIsFullscreen(fsEl === ref.current);
        };
        document.addEventListener('fullscreenchange', onChange);
        document.addEventListener('webkitfullscreenchange', onChange);
        return () => {
            document.removeEventListener('fullscreenchange', onChange);
            document.removeEventListener('webkitfullscreenchange', onChange);
        };
    }, []);

    const toggle = useCallback(() => {
        const el = ref.current as any;
        const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
        if (fsEl) {
            const exit = document.exitFullscreen || (document as any).webkitExitFullscreen;
            exit?.call(document)?.catch?.(() => {});
            return;
        }
        const request = el?.requestFullscreen || el?.webkitRequestFullscreen;
        request?.call(el)?.catch?.(() => {});
    }, []);

    return { ref, isFullscreen, toggle };
}
