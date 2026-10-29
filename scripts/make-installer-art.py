"""Gera a arte do instalador NSIS em src-tauri/installer/.

    python scripts/make-installer-art.py

- installer.ico   ícone do setup.exe: mesmo quadrado roxo do app, com seta de
                  download no lugar da chave (para não confundir com o app).
- sidebar.bmp     164x314, telas de boas-vindas e conclusão.
- header.bmp      150x57, cabeçalho das telas do meio.

Cores = tokens do tema escuro em src/index.css (--c-bg-primary, --c-accent,
--c-accent-hover). Mudou o tema, rode de novo.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src-tauri" / "installer"
APP_ICON = ROOT / "src-tauri" / "icons" / "icon.png"
FONT_BOLD = ROOT / "assets" / "fonts" / "Montserrat-Bold.ttf"
FONT_REG = ROOT / "assets" / "fonts" / "Inter-Regular.ttf"

BG = (14, 14, 20)
ACCENT = (168, 85, 247)
DEEP = (131, 0, 255)
TEXT = (226, 226, 236)
MUTED = (136, 136, 168)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size, top, bottom):
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = lerp(top, bottom, (y / h) * 0.7 + (x / w) * 0.3)
    return img


def installer_icon(s=256):
    """Quadrado arredondado roxo + bandeja com seta para baixo."""
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    mask = Image.new("L", (s, s), 0)
    r = int(s * 0.2)
    ImageDraw.Draw(mask).rounded_rectangle([s * 0.04, s * 0.04, s * 0.96, s * 0.96], r, fill=255)
    img.paste(gradient((s, s), (196, 120, 255), DEEP), (0, 0), mask)

    # Brilho superior, como no ícone do app.
    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([s * 0.1, -s * 0.35, s * 0.9, s * 0.42], fill=(255, 255, 255, 60))
    img = Image.alpha_composite(img, Image.composite(glow, Image.new("RGBA", (s, s)), mask))

    # Seta + bandeja, com halo branco desfocado por trás.
    art = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(art)
    lw = int(s * 0.075)
    cx = s / 2
    d.line([cx, s * 0.22, cx, s * 0.58], fill=(255, 255, 255, 235), width=lw)
    d.line([cx - s * 0.17, s * 0.43, cx, s * 0.60], fill=(255, 255, 255, 235), width=lw, joint="curve")
    d.line([cx + s * 0.17, s * 0.43, cx, s * 0.60], fill=(255, 255, 255, 235), width=lw, joint="curve")
    d.line([s * 0.24, s * 0.66, s * 0.24, s * 0.77, s * 0.76, s * 0.77, s * 0.76, s * 0.66],
           fill=(255, 255, 255, 235), width=lw, joint="curve")
    halo = art.filter(ImageFilter.GaussianBlur(s * 0.03))
    img = Image.alpha_composite(img, halo)
    img = Image.alpha_composite(img, art)
    return img


def text(draw, xy, s, font, size, fill, anchor="la"):
    draw.text(xy, s, font=ImageFont.truetype(str(font), size), fill=fill, anchor=anchor)


def sidebar():
    w, h = 164, 314
    img = Image.new("RGB", (w, h), BG)
    # Brilho roxo difuso, eco do gradiente de ondas do app.
    blob = Image.new("RGB", (w, h), BG)
    bd = ImageDraw.Draw(blob)
    bd.ellipse([-80, 150, 200, 420], fill=DEEP)
    bd.ellipse([40, -60, 260, 140], fill=(90, 40, 160))
    img = Image.blend(img, blob.filter(ImageFilter.GaussianBlur(45)), 0.55)

    icon = Image.open(APP_ICON).convert("RGBA").resize((72, 72), Image.LANCZOS)
    img.paste(icon, ((w - 72) // 2, 52), icon)

    d = ImageDraw.Draw(img)
    text(d, (w / 2, 146), "CAMPS-UTILS", FONT_BOLD, 17, TEXT, "ma")
    text(d, (w / 2, 170), "Utilitários locais", FONT_REG, 11, MUTED, "ma")
    d.line([w / 2 - 22, 194, w / 2 + 22, 194], fill=ACCENT, width=2)
    text(d, (w / 2, 284), "Tudo roda no seu PC", FONT_REG, 10, MUTED, "ma")
    return img


def header():
    w, h = 150, 57
    img = Image.new("RGB", (w, h), BG)
    icon = Image.open(APP_ICON).convert("RGBA").resize((34, 34), Image.LANCZOS)
    img.paste(icon, (w - 34 - 10, (h - 34) // 2), icon)
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    ico = installer_icon()
    ico.save(OUT / "installer.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    ico.save(OUT / "installer-preview.png")
    sidebar().save(OUT / "sidebar.bmp")
    header().save(OUT / "header.bmp")
    print("Arte do instalador gerada em", OUT)


if __name__ == "__main__":
    main()
