"""Generate every brand asset the site serves, from the two source images.

Sources (committed, the originals supplied by the site owner). They live in brand/
rather than public/ deliberately: Vite copies public/ verbatim into dist, and the
1.5 MB source logo has no business being shipped to every visitor.
    brand/logo.png      1024x1024 RGBA  — the full يلا ماتش mark + wordmark
    brand/favicon.png    128x128  RGBA  — the football glyph used as the tab icon

Outputs (all written into public/, so Vite copies them to the site root):
    favicon.ico            16 + 32 + 48 multi-resolution, for the browser tab
    favicon-32.png         explicit PNG for browsers that prefer it
    apple-touch-icon.png   180x180, iOS home screen
    icon-192.png           PWA manifest
    icon-512.png           PWA manifest
    logo.png               the 1024 logo, referenced by Organization.logo in JSON-LD
    og-image.jpg           1200x630 social card, logo on the brand gradient

This replaces a set of hotlinks to cdn-icons-png.flaticon.com — a generic football
icon on a third-party CDN that nobody here controls — and the earlier typographic
placeholder card.

Usage, from the repo root:

    python scripts/gen-brand-assets.py

Requires: pip install Pillow
"""
from __future__ import annotations

import os

from PIL import Image

SRC_DIR = "brand"
OUT = "public"

# Brand emerald, from <meta name="theme-color" content="#059669"> in index.html.
EMERALD_DARK = (4, 90, 63)
EMERALD = (5, 150, 105)


def load(name: str) -> Image.Image:
    path = os.path.join(SRC_DIR, name)
    if not os.path.exists(path):
        raise SystemExit(f"missing source image: {path}")
    return Image.open(path).convert("RGBA")


def trimmed(img: Image.Image) -> Image.Image:
    """Crop away fully transparent margins so the mark fills the icon box."""
    box = img.getbbox()
    return img.crop(box) if box else img


def square(img: Image.Image, size: int, pad_ratio: float = 0.06) -> Image.Image:
    """Fit `img` into a transparent square of `size`, keeping aspect ratio."""
    art = trimmed(img)
    inner = int(size * (1 - pad_ratio * 2))
    art.thumbnail((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(art, ((size - art.width) // 2, (size - art.height) // 2), art)
    return canvas


def og_card(logo: Image.Image) -> Image.Image:
    """1200x630 social card: the real logo on the brand gradient."""
    W, H = 1200, 630
    card = Image.new("RGB", (W, H))
    px = card.load()
    for y in range(H):
        t = y / H
        row = tuple(int(a + (b - a) * t) for a, b in zip(EMERALD_DARK, EMERALD))
        for x in range(W):
            px[x, y] = row

    art = trimmed(logo)
    art.thumbnail((int(W * 0.62), int(H * 0.78)), Image.LANCZOS)
    card.paste(art, ((W - art.width) // 2, (H - art.height) // 2), art)
    return card


def main() -> None:
    logo = load("logo.png")
    fav = load("favicon.png")

    os.makedirs(OUT, exist_ok=True)
    written: list[tuple[str, str]] = []

    def save(img: Image.Image, name: str, **kw) -> None:
        path = os.path.join(OUT, name)
        img.save(path, **kw)
        written.append((name, f"{os.path.getsize(path) // 1024 or 1} KB"))

    # Tab icon — .ico carries 16/32/48 so every browser picks a crisp size.
    ico = square(fav, 256, pad_ratio=0.02)
    save(ico, "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    save(square(fav, 32, pad_ratio=0.02), "favicon-32.png", format="PNG")

    # Home-screen and PWA icons use the full logo.
    save(square(logo, 180), "apple-touch-icon.png", format="PNG")
    save(square(logo, 192), "icon-192.png", format="PNG")
    save(square(logo, 512), "icon-512.png", format="PNG")

    # Organization.logo in the JSON-LD points at this.
    save(square(logo, 512, pad_ratio=0.0), "logo.png", format="PNG")

    save(og_card(logo), "og-image.jpg", format="JPEG", quality=90, optimize=True)

    width = max(len(n) for n, _ in written)
    for name, size in written:
        print(f"  {name.ljust(width)}  {size}")


if __name__ == "__main__":
    main()
