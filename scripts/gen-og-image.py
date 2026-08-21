"""Generate public/og-image.jpg — the Open Graph / Twitter card image.

Why this exists: index.html, utils/seo.ts and the WordPress theme all reference
`/og-image.jpg`, but no such file existed anywhere in the repo, so the live site
returned 404 for it and every social share rendered with no image.

This is a GENERATED PLACEHOLDER built from the brand tokens already in the repo
(the emerald `theme-color` from index.html and the site name). It is deliberately
typographic: there is no owned logo artwork in this project — the PWA manifest
hotlinks its icons from flaticon — so there was nothing to composite. Replace the
output with real artwork when you have it; nothing depends on this script at build
or run time.

Usage, from the repo root:

    python scripts/gen-og-image.py

Requires: pip install Pillow arabic-reshaper python-bidi
"""
from __future__ import annotations

import os

from PIL import Image, ImageDraw, ImageFont
import arabic_reshaper

try:  # python-bidi moved this between major versions
    from bidi.algorithm import get_display
except ImportError:  # pragma: no cover
    from bidi import get_display  # type: ignore

W, H = 1200, 630  # the size every major platform crops against
OUT = os.path.join("public", "og-image.jpg")

# Brand emerald, taken from <meta name="theme-color" content="#059669"> in index.html.
EMERALD_DARK = (4, 90, 63)
EMERALD = (5, 150, 105)
WHITE = (255, 255, 255)
MINT = (167, 243, 208)

FONT_AR = "C:/Windows/Fonts/majallab.ttf"   # Majalla Bold — a proper Arabic face
FONT_LAT = "C:/Windows/Fonts/segoeuib.ttf"  # Segoe UI Bold


def arabic(text: str) -> str:
    """Shape + reorder Arabic so it renders joined and right-to-left.

    Pillow draws raw codepoints left to right with no shaping, so without this
    step Arabic comes out as disconnected letters in reverse order.
    """
    return get_display(arabic_reshaper.reshape(text))


def main() -> None:
    img = Image.new("RGB", (W, H), EMERALD)
    d = ImageDraw.Draw(img)

    # Vertical gradient, dark at the top so white type stays legible.
    for y in range(H):
        t = y / H
        d.line(
            [(0, y), (W, y)],
            fill=tuple(int(a + (b - a) * t) for a, b in zip(EMERALD_DARK, EMERALD)),
        )

    # Pitch motif: centre circle and halfway line, low contrast so it reads as texture.
    ring = (255, 255, 255, 0)
    d.ellipse([W // 2 - 150, H // 2 - 150, W // 2 + 150, H // 2 + 150], outline=(255, 255, 255), width=3)
    d.line([(W // 2, 0), (W // 2, H)], fill=(255, 255, 255), width=2)
    overlay = Image.new("RGB", (W, H), (0, 0, 0))
    img = Image.blend(img, Image.blend(img, overlay, 0.0), 0.0)
    # Fade the motif back by redrawing the gradient at partial opacity.
    motif = img.copy()
    grad = Image.new("RGB", (W, H))
    gd = ImageDraw.Draw(grad)
    for y in range(H):
        t = y / H
        gd.line([(0, y), (W, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(EMERALD_DARK, EMERALD)))
    img = Image.blend(motif, grad, 0.88)
    d = ImageDraw.Draw(img)

    f_ar = ImageFont.truetype(FONT_AR, 150)
    f_lat = ImageFont.truetype(FONT_LAT, 44)
    f_tag = ImageFont.truetype(FONT_AR, 46)

    def centered(text: str, font: ImageFont.FreeTypeFont, y: int, fill) -> None:
        left, top, right, bottom = d.textbbox((0, 0), text, font=font)
        d.text(((W - (right - left)) / 2 - left, y - top), text, font=font, fill=fill)

    centered(arabic("يلا ماتش"), f_ar, 150, WHITE)

    # Letter-spaced Latin wordmark, matching the "- Yalla Match" half of <title>.
    lat = "Y A L L A   M A T C H"
    centered(lat, f_lat, 330, MINT)

    # Accent rule between wordmark and tagline.
    d.rounded_rectangle([W // 2 - 70, 405, W // 2 + 70, 411], radius=3, fill=MINT)

    centered(arabic("مباريات اليوم • البث المباشر • القنوات الناقلة"), f_tag, 455, WHITE)
    centered("yallamatch.online", ImageFont.truetype(FONT_LAT, 32), 545, MINT)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT, "JPEG", quality=90, optimize=True)
    print(f"wrote {OUT}  {img.size[0]}x{img.size[1]}  {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    main()
