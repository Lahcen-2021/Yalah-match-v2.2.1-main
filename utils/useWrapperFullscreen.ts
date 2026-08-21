import { useCallback, useEffect, useRef, useState } from 'react';

// Fullscreens a WRAPPER element rather than the video itself.
//
// A player's own fullscreen button takes only its own element fullscreen, which leaves
// sibling overlay divs (our logo, caption and ad banner) behind — they simply vanish for
// as long as fullscreen lasts. Pointing fullscreen at the wrapper that holds the video
// AND the overlays keeps them on screen together.
//
// The embeds ALSO permit native fullscreen (allowFullScreen + allow="fullscreen"), so a
// viewer has two routes:
//
//   * the player's own fullscreen button  -> the iframe goes fullscreen natively. Our
//     overlays sit outside the iframe, so they are not visible for its duration. That is
//     the ordinary tradeoff every site embedding a third-party player makes.
//   * this hook's button (PlayerControls) -> the WRAPPER goes fullscreen, keeping the
//     video and the overlays together.
//
// An earlier version tried to have both: it watched for the iframe making itself the
// fullscreen element and swapped fullscreen onto the wrapper. That was removed. Swapping
// the fullscreen element out from under the embed makes the embedded player observe
// "fullscreen ended" through its own fullscreenchange listener, and players routinely
// react by resetting or exiting — so the viewer was bounced straight back out and
// fullscreen appeared to do nothing at all. A plain native fullscreen that works beats a
// branded one that does not.

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
