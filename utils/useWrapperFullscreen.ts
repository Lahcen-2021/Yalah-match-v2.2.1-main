import { useCallback, useEffect, useRef, useState } from 'react';

// Fullscreens a WRAPPER element rather than the video itself.
//
// A player's own fullscreen button takes only its own element fullscreen, which leaves
// sibling overlay divs (our logo, caption and ad banner) behind — they simply vanish for
// as long as fullscreen lasts. Pointing fullscreen at the wrapper that holds the video
// AND the overlays keeps them on screen together.
//
// The embed's OWN fullscreen button used to be disabled outright to force everyone
// through this route. That made the button inside third-party players do nothing at all,
// which reads as a broken site. Instead the embeds now permit fullscreen, and this hook
// redirects it: when a descendant (the embed's iframe) makes itself the fullscreen
// element, fullscreen is re-pointed at the wrapper so the overlays come along.
//
// The redirect is best-effort and deliberately cannot make things worse: it swaps the
// fullscreen element in place rather than exiting and re-entering. If the browser
// refuses the swap, the embed simply stays fullscreen on its own — the viewer still gets
// fullscreen, just without the overlays. That is strictly better than a button that does
// nothing, which is what blocking fullscreen produced.
export function useWrapperFullscreen<T extends HTMLElement = HTMLDivElement>() {
    const ref = useRef<T>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // True while an exit->re-request round trip is in flight, so the intermediate
    // fullscreenchange events it fires are not mistaken for the user leaving fullscreen.
    const redirecting = useRef(false);

    useEffect(() => {
        // Safari fires the webkit-prefixed event only, so listen for both.
        const onChange = () => {
            const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
            const wrap = ref.current;

            if (redirecting.current) {
                if (fsEl === wrap) redirecting.current = false; // landed on the wrapper
                setIsFullscreen(fsEl === wrap);
                return;
            }

            // A descendant went fullscreen by itself — the embed's own control. That
            // element holds the video but none of our overlays, so hand fullscreen to
            // the wrapper instead.
            if (fsEl && wrap && fsEl !== wrap && wrap.contains(fsEl)) {
                // Request straight on the wrapper — do NOT exit first. Requesting
                // fullscreen for a different element while already fullscreen swaps the
                // fullscreen element in place. Exiting first would spend the user
                // activation, and if the follow-up request were then refused the viewer
                // would be thrown OUT of fullscreen entirely — reproducing the very bug
                // this fixes. Failing a swap merely leaves the embed fullscreen.
                redirecting.current = true;
                const request = (wrap as any).requestFullscreen || (wrap as any).webkitRequestFullscreen;
                Promise.resolve(request?.call(wrap))
                    .catch(() => { redirecting.current = false; });
                return;
            }

            setIsFullscreen(fsEl === wrap);
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
