from __future__ import annotations

import math
import random
from pathlib import Path
from typing import Iterable, Sequence

from PIL import Image, ImageDraw, ImageFilter
from reportlab.lib.colors import Color, HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public"
PDF_PATH = OUT_DIR / "ai-education-keynote.pdf"
PREVIEW_PATH = OUT_DIR / "ai-education-keynote-preview.png"
BG_DIR = ROOT / "scripts" / ".generated_ai_keynote"

PAGE_W = 16 * 72
PAGE_H = 9 * 72
BG_W = 1920
BG_H = 1080

NAVY_0 = "#081120"
NAVY_1 = "#132238"
CYAN = "#19D9FF"
CYAN_SOFT = "#72F0FF"
WHITE = "#F4FBFF"
MUTED = "#A9C2D4"
BLUE = "#4C7DFF"
VIOLET = "#8A6CFF"
MINT = "#5AF2C7"
AMBER = "#FFD166"
PINK = "#FF5DA2"

RANDOM_SEED = 42


def register_fonts() -> dict[str, str]:
    fonts = {
        "regular": "Helvetica",
        "bold": "Helvetica-Bold",
        "semibold": "Helvetica-Bold",
    }
    candidates = {
        "regular": Path("C:/Windows/Fonts/segoeui.ttf"),
        "bold": Path("C:/Windows/Fonts/segoeuib.ttf"),
        "semibold": Path("C:/Windows/Fonts/seguisb.ttf"),
    }
    for key, path in candidates.items():
        if path.exists():
            name = f"Segoe-{key}"
            pdfmetrics.registerFont(TTFont(name, str(path)))
            fonts[key] = name
    return fonts


FONTS = register_fonts()


def rgb(hex_color: str) -> tuple[int, int, int]:
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))


def blend(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))


def color(hex_color: str, alpha: float = 1) -> Color:
    r, g, b = rgb(hex_color)
    return Color(r / 255, g / 255, b / 255, alpha=alpha)


def set_fill(c: canvas.Canvas, hex_color: str, alpha: float = 1) -> None:
    c.setFillColor(HexColor(hex_color))
    c.setFillAlpha(alpha)


def set_stroke(c: canvas.Canvas, hex_color: str, alpha: float = 1, width: float = 1) -> None:
    c.setStrokeColor(HexColor(hex_color))
    c.setStrokeAlpha(alpha)
    c.setLineWidth(width)


def reset_alpha(c: canvas.Canvas) -> None:
    c.setFillAlpha(1)
    c.setStrokeAlpha(1)


def background(slide_no: int, variant: int) -> Path:
    BG_DIR.mkdir(parents=True, exist_ok=True)
    out = BG_DIR / f"slide_{slide_no:02d}.png"

    rng = random.Random(RANDOM_SEED + slide_no * 17 + variant)
    a = rgb(NAVY_0)
    b = rgb(NAVY_1)
    img = Image.new("RGB", (BG_W, BG_H), a)
    base = ImageDraw.Draw(img)
    for y in range(BG_H):
        t = y / (BG_H - 1)
        base.line([(0, y), (BG_W, y)], fill=blend(a, b, t))

    # Layered radial washes give a high-end mesh-gradient feel without slow
    # per-pixel rendering.
    wash = Image.new("RGBA", img.size, (0, 0, 0, 0))
    wd = ImageDraw.Draw(wash, "RGBA")
    accents = [(25, 217, 255, 48), (76, 125, 255, 36), (90, 242, 199, 28)]
    centers = [
        (BG_W * (0.18 + 0.08 * math.sin(slide_no)), BG_H * 0.22),
        (BG_W * 0.78, BG_H * (0.36 + 0.1 * math.cos(slide_no))),
        (BG_W * 0.48, BG_H * 0.92),
    ]
    for (cx, cy), rgba in zip(centers, accents):
        rw = rng.randint(520, 820)
        rh = rng.randint(360, 620)
        wd.ellipse((cx - rw, cy - rh, cx + rw, cy + rh), fill=rgba)
    wash = wash.filter(ImageFilter.GaussianBlur(110))
    img = Image.alpha_composite(img.convert("RGBA"), wash).convert("RGB")

    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay, "RGBA")

    grid = (114, 240, 255, 22)
    for x in range(0, BG_W, 80):
        d.line([(x, 0), (x, BG_H)], fill=grid, width=1)
    for y in range(0, BG_H, 80):
        d.line([(0, y), (BG_W, y)], fill=grid, width=1)
    for x in range(0, BG_W, 320):
        d.line([(x, 0), (x, BG_H)], fill=(114, 240, 255, 34), width=1)
    for y in range(0, BG_H, 320):
        d.line([(0, y), (BG_W, y)], fill=(114, 240, 255, 34), width=1)

    # Soft luminous subnet that varies from slide to slide.
    nodes: list[tuple[int, int]] = []
    for _ in range(34):
        nx = int(rng.uniform(-80, BG_W + 80))
        ny = int(rng.uniform(-40, BG_H + 40))
        if rng.random() < 0.58:
            nx = int(rng.gauss(BG_W * 0.76, BG_W * 0.16))
            ny = int(rng.gauss(BG_H * 0.42, BG_H * 0.28))
        nodes.append((nx, ny))
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow, "RGBA")
    for i, p in enumerate(nodes):
        close = sorted(nodes, key=lambda q: (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2)[1:4]
        for q in close:
            if rng.random() < 0.58:
                gd.line([p, q], fill=(25, 217, 255, 66), width=3)
    for p in nodes:
        r = rng.randint(5, 10)
        gd.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=(25, 217, 255, 130))
    glow = glow.filter(ImageFilter.GaussianBlur(7))
    overlay.alpha_composite(glow)
    d = ImageDraw.Draw(overlay, "RGBA")
    for i, p in enumerate(nodes):
        close = sorted(nodes, key=lambda q: (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2)[1:3]
        for q in close:
            if rng.random() < 0.45:
                d.line([p, q], fill=(25, 217, 255, 62), width=1)
        r = 3
        d.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=(170, 250, 255, 150))

    formulas = [
        "P(K_t | obs_1:t)",
        "theta <- theta + eta grad L",
        "E[mastery | evidence]",
        "x_i in R^d",
        "p(correct)=sigma(a(theta-b))",
        "Delta learning = post - pre",
        "argmax_i I(item_i; skill)",
        "z_t = f(e_t, c_t)",
    ]
    try:
        font_path = "C:/Windows/Fonts/consola.ttf"
        from PIL import ImageFont

        fnt = ImageFont.truetype(font_path, 33)
    except Exception:
        fnt = None
    for i, eq in enumerate(formulas):
        x = rng.randint(70, BG_W - 520)
        y = rng.randint(80, BG_H - 110)
        d.text((x, y), eq, fill=(210, 245, 255, 26), font=fnt)

    # Subtle vignette.
    vig = Image.new("L", img.size, 0)
    vd = ImageDraw.Draw(vig)
    for r in range(880, 1800, 10):
        alpha = int(max(0, min(190, (r - 880) / 920 * 190)))
        vd.ellipse((BG_W / 2 - r, BG_H / 2 - r, BG_W / 2 + r, BG_H / 2 + r), outline=alpha, width=12)
    vignette = Image.new("RGBA", img.size, (0, 0, 0, 0))
    vignette.putalpha(vig.filter(ImageFilter.GaussianBlur(12)))
    overlay.alpha_composite(vignette)

    img = Image.alpha_composite(img.convert("RGBA"), overlay)
    img.save(out)
    return out


def bg(c: canvas.Canvas, slide_no: int, variant: int = 0) -> None:
    path = background(slide_no, variant)
    c.drawImage(str(path), 0, 0, width=PAGE_W, height=PAGE_H, mask="auto")


def text(
    c: canvas.Canvas,
    value: str,
    x: float,
    y: float,
    size: float,
    font: str = "regular",
    fill: str = WHITE,
    alpha: float = 1,
    align: str = "left",
    leading: float | None = None,
) -> None:
    c.setFont(FONTS[font], size)
    set_fill(c, fill, alpha)
    if "\n" in value:
        lines = value.splitlines()
        lead = leading or size * 1.18
        for i, line in enumerate(lines):
            text(c, line, x, y - i * lead, size, font, fill, alpha, align)
        return
    if align == "center":
        c.drawCentredString(x, y, value)
    elif align == "right":
        c.drawRightString(x, y, value)
    else:
        c.drawString(x, y, value)
    reset_alpha(c)


def para(
    c: canvas.Canvas,
    lines: Sequence[str],
    x: float,
    y: float,
    size: float = 17,
    leading: float = 24,
    fill: str = MUTED,
    font: str = "regular",
) -> None:
    for i, line in enumerate(lines):
        text(c, line, x, y - i * leading, size, font=font, fill=fill, alpha=0.96)


def pill(c: canvas.Canvas, label: str, x: float, y: float, w: float, accent: str = CYAN) -> None:
    set_fill(c, "#0B1B2B", 0.52)
    set_stroke(c, accent, 0.5, 1)
    c.roundRect(x, y, w, 28, 14, fill=1, stroke=1)
    text(c, label.upper(), x + w / 2, y + 9, 9, font="semibold", fill=accent, alpha=0.95, align="center")


def glass(c: canvas.Canvas, x: float, y: float, w: float, h: float, radius: float = 14, alpha: float = 0.16) -> None:
    set_fill(c, "#E6FAFF", alpha)
    set_stroke(c, CYAN_SOFT, 0.28, 1.05)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)
    set_stroke(c, WHITE, 0.16, 0.6)
    c.roundRect(x + 1.2, y + 1.2, w - 2.4, h - 2.4, radius - 1, fill=0, stroke=1)
    reset_alpha(c)


def glow_line(c: canvas.Canvas, points: Sequence[tuple[float, float]], col: str = CYAN, width: float = 1.4) -> None:
    for alpha, extra in [(0.16, 7), (0.22, 4), (0.7, 0)]:
        set_stroke(c, col, alpha, width + extra)
        p = c.beginPath()
        p.moveTo(points[0][0], points[0][1])
        for x, y in points[1:]:
            p.lineTo(x, y)
        c.drawPath(p)
    reset_alpha(c)


def draw_network(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    layers: Sequence[int] = (4, 6, 5, 3),
    accent: str = CYAN,
) -> None:
    coords: list[list[tuple[float, float]]] = []
    for li, count in enumerate(layers):
        lx = x + (li / (len(layers) - 1)) * w
        layer = []
        for ni in range(count):
            if count == 1:
                ly = y + h / 2
            else:
                ly = y + h - (ni / (count - 1)) * h
            layer.append((lx, ly))
        coords.append(layer)
    for a, b in zip(coords, coords[1:]):
        for p in a:
            for q in b:
                if (int(p[1] + q[1] + p[0]) % 3) != 0:
                    glow_line(c, [p, q], col=accent, width=0.45)
    for layer in coords:
        for px, py in layer:
            set_fill(c, accent, 0.20)
            set_stroke(c, CYAN_SOFT, 0.65, 1.1)
            c.circle(px, py, 9, fill=1, stroke=1)
            set_fill(c, WHITE, 0.9)
            c.circle(px, py, 2.2, fill=1, stroke=0)
    reset_alpha(c)


def draw_hud_orbit(c: canvas.Canvas, cx: float, cy: float, r: float) -> None:
    for i, col in enumerate([CYAN, BLUE, VIOLET]):
        set_stroke(c, col, 0.28, 1)
        c.ellipse(cx - r * (1 + i * 0.14), cy - r * (0.52 + i * 0.08), cx + r * (1 + i * 0.14), cy + r * (0.52 + i * 0.08), stroke=1, fill=0)
    set_stroke(c, CYAN, 0.7, 1.2)
    c.arc(cx - r, cy - r, cx + r, cy + r, 18, 90)
    c.arc(cx - r * 1.14, cy - r * 0.66, cx + r * 1.14, cy + r * 0.66, 194, 82)
    for ang in [28, 128, 246, 315]:
        px = cx + math.cos(math.radians(ang)) * r * 1.05
        py = cy + math.sin(math.radians(ang)) * r * 0.66
        set_fill(c, CYAN_SOFT, 0.78)
        c.circle(px, py, 4.2, fill=1, stroke=0)
    reset_alpha(c)


def line_chart(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    series: Sequence[float],
    col: str = CYAN,
    fill_under: bool = True,
) -> None:
    set_stroke(c, WHITE, 0.12, 0.8)
    for i in range(4):
        yy = y + h * i / 3
        c.line(x, yy, x + w, yy)
    points = []
    for i, val in enumerate(series):
        px = x + w * i / (len(series) - 1)
        py = y + h * val
        points.append((px, py))
    if fill_under:
        set_fill(c, col, 0.08)
        p = c.beginPath()
        p.moveTo(points[0][0], y)
        for px, py in points:
            p.lineTo(px, py)
        p.lineTo(points[-1][0], y)
        p.close()
        c.drawPath(p, fill=1, stroke=0)
    glow_line(c, points, col=col, width=1.8)
    for px, py in points[::2]:
        set_fill(c, col, 0.85)
        c.circle(px, py, 2.8, fill=1, stroke=0)
    reset_alpha(c)


def bar_chart(c: canvas.Canvas, x: float, y: float, w: float, h: float, values: Sequence[float], cols: Sequence[str]) -> None:
    gap = w / (len(values) * 3 + 1)
    bw = gap * 2
    for i, val in enumerate(values):
        bx = x + gap + i * (bw + gap)
        bh = h * val
        set_fill(c, cols[i % len(cols)], 0.24)
        set_stroke(c, cols[i % len(cols)], 0.75, 1)
        c.roundRect(bx, y, bw, bh, 6, fill=1, stroke=1)
    reset_alpha(c)


def heatmap(c: canvas.Canvas, x: float, y: float, w: float, h: float, rows: int, cols: int, seed: int) -> None:
    rng = random.Random(seed)
    cell_w = w / cols
    cell_h = h / rows
    palette = [CYAN, BLUE, VIOLET, MINT, AMBER]
    for r in range(rows):
        for col_idx in range(cols):
            intensity = (math.sin(col_idx * 0.9 + r * 0.65) + 1) / 2
            intensity = intensity * 0.55 + rng.random() * 0.45
            chosen = palette[int(intensity * (len(palette) - 1))]
            set_fill(c, chosen, 0.14 + intensity * 0.34)
            set_stroke(c, WHITE, 0.04, 0.2)
            c.roundRect(x + col_idx * cell_w + 1.6, y + r * cell_h + 1.6, cell_w - 3.2, cell_h - 3.2, 3, fill=1, stroke=1)
    reset_alpha(c)


def radar(c: canvas.Canvas, cx: float, cy: float, r: float, values: Sequence[float], labels: Sequence[str]) -> None:
    n = len(values)
    for ring in [0.33, 0.66, 1.0]:
        pts = []
        for i in range(n):
            ang = math.radians(90 + i * 360 / n)
            pts.append((cx + math.cos(ang) * r * ring, cy + math.sin(ang) * r * ring))
        set_stroke(c, WHITE, 0.12, 0.8)
        p = c.beginPath()
        p.moveTo(*pts[0])
        for pt in pts[1:]:
            p.lineTo(*pt)
        p.close()
        c.drawPath(p)
    pts = []
    for i, val in enumerate(values):
        ang = math.radians(90 + i * 360 / n)
        pts.append((cx + math.cos(ang) * r * val, cy + math.sin(ang) * r * val))
        set_stroke(c, WHITE, 0.11, 0.6)
        c.line(cx, cy, cx + math.cos(ang) * r, cy + math.sin(ang) * r)
        text(c, labels[i], cx + math.cos(ang) * (r + 24), cy + math.sin(ang) * (r + 24) - 4, 9, fill=MUTED, alpha=0.9, align="center")
    set_fill(c, CYAN, 0.16)
    set_stroke(c, CYAN, 0.9, 1.8)
    p = c.beginPath()
    p.moveTo(*pts[0])
    for pt in pts[1:]:
        p.lineTo(*pt)
    p.close()
    c.drawPath(p, fill=1, stroke=1)
    reset_alpha(c)


def gauge(c: canvas.Canvas, cx: float, cy: float, r: float, pct: float, label: str, col: str = CYAN) -> None:
    set_stroke(c, WHITE, 0.14, 8)
    c.arc(cx - r, cy - r, cx + r, cy + r, 200, 140)
    set_stroke(c, col, 0.85, 8)
    c.arc(cx - r, cy - r, cx + r, cy + r, 200, 140 * pct)
    text(c, f"{int(pct * 100)}%", cx, cy - 2, 23, font="bold", fill=WHITE, align="center")
    text(c, label, cx, cy - 24, 9.5, font="semibold", fill=MUTED, align="center")
    reset_alpha(c)


def icon_circle(c: canvas.Canvas, x: float, y: float, label: str, accent: str) -> None:
    set_fill(c, accent, 0.12)
    set_stroke(c, accent, 0.8, 1.2)
    c.circle(x, y, 23, fill=1, stroke=1)
    text(c, label, x, y - 5.5, 14, font="bold", fill=WHITE, align="center")


def footer(c: canvas.Canvas, slide: int, section: str = "AI in Education") -> None:
    set_stroke(c, CYAN, 0.35, 0.8)
    c.line(54, 34, 182, 34)
    text(c, section.upper(), 54, 42, 8.5, font="semibold", fill=CYAN, alpha=0.75)
    text(c, f"{slide:02d}", PAGE_W - 54, 36, 10, font="semibold", fill=MUTED, alpha=0.75, align="right")


def title_slide(c: canvas.Canvas) -> None:
    bg(c, 1, 1)
    pill(c, "Academic AI-in-Education Keynote", 58, PAGE_H - 92, 236, CYAN)
    text(c, "Adaptive Intelligence\nfor Mathematical Learning", 58, 418, 45, font="bold", fill=WHITE, leading=50)
    para(
        c,
        ["Learning analytics, neural assessment, and human-centered AI", "for evidence-rich mathematics education."],
        62,
        315,
        size=18,
        leading=26,
    )
    glass(c, 660, 132, 390, 390, radius=22, alpha=0.12)
    draw_hud_orbit(c, 855, 327, 126)
    draw_network(c, 722, 234, 266, 188, layers=(3, 5, 6, 4), accent=CYAN)
    text(c, "f_theta(x) -> mastery", 760, 173, 17, font="semibold", fill=CYAN_SOFT, alpha=0.9)
    text(c, "Conference Presentation | 16:9", 62, 82, 12, font="semibold", fill=MUTED, alpha=0.92)
    footer(c, 1, "Opening")
    c.showPage()


def research_problem(c: canvas.Canvas) -> None:
    bg(c, 2, 2)
    pill(c, "Research Lens", 58, PAGE_H - 90, 140, CYAN)
    text(c, "The evidence gap in mathematics learning", 58, 512, 34, font="bold")
    para(c, ["Assessment is episodic.", "Reasoning is continuous.", "Instruction needs evidence in real time."], 62, 467, 17, 27)

    labels = [("Learner", 230, 254, MINT), ("Task", 478, 368, CYAN), ("Evidence", 718, 252, BLUE), ("Teacher", 480, 138, AMBER)]
    for i, (_, x, y, _) in enumerate(labels):
        for _, x2, y2, col2 in labels[i + 1 :]:
            glow_line(c, [(x, y), (x2, y2)], col=col2, width=1.1)
    for label, x, y, col in labels:
        glass(c, x - 76, y - 38, 152, 76, radius=18, alpha=0.18)
        icon_circle(c, x - 43, y, label[:2].upper(), col)
        text(c, label, x + 4, y + 7, 16, font="semibold", fill=WHITE)
        text(c, "signals", x + 4, y - 13, 10, font="regular", fill=MUTED, alpha=0.9)

    glass(c, 810, 376, 250, 132, radius=16, alpha=0.13)
    text(c, "Observed trace", 832, 472, 13, font="semibold", fill=CYAN)
    line_chart(c, 832, 412, 200, 38, [0.15, 0.2, 0.33, 0.31, 0.48, 0.62, 0.58, 0.74], MINT)
    text(c, "hint latency | revisions | transfer", 832, 394, 10, fill=MUTED, alpha=0.86)

    glass(c, 74, 126, 264, 126, radius=16, alpha=0.13)
    text(c, "Design objective", 98, 216, 13, font="semibold", fill=CYAN)
    text(c, "Turn sparse scores into\ninterpretable learning states.", 98, 179, 21, font="bold", fill=WHITE, leading=25)
    footer(c, 2, "Problem")
    c.showPage()


def system_architecture(c: canvas.Canvas) -> None:
    bg(c, 3, 3)
    pill(c, "System Architecture", 58, PAGE_H - 90, 168, CYAN)
    text(c, "A closed loop for adaptive mathematical learning", 58, 512, 32, font="bold")
    glass(c, 64, 124, 1024, 330, radius=24, alpha=0.1)

    stages = [
        ("1", "Math tasks", "symbolic + open response", CYAN),
        ("2", "AI tutor", "feedback + scaffolds", BLUE),
        ("3", "Telemetry", "steps, timing, revisions", VIOLET),
        ("4", "Student model", "latent skill estimate", MINT),
        ("5", "Dashboard", "teacher decisions", AMBER),
    ]
    xs = [154, 352, 550, 748, 946]
    y = 284
    for i, (num, title, sub, col) in enumerate(stages):
        glass(c, xs[i] - 74, y - 62, 148, 124, radius=18, alpha=0.16)
        icon_circle(c, xs[i], y + 23, num, col)
        text(c, title, xs[i], y - 20, 16, font="semibold", align="center")
        text(c, sub, xs[i], y - 42, 9.2, fill=MUTED, alpha=0.92, align="center")
        if i < len(xs) - 1:
            glow_line(c, [(xs[i] + 78, y + 2), (xs[i + 1] - 78, y + 2)], col=stages[i + 1][3], width=1.6)
            set_fill(c, stages[i + 1][3], 0.9)
            c.circle(xs[i + 1] - 82, y + 2, 3.5, fill=1, stroke=0)

    set_stroke(c, CYAN, 0.45, 1.4)
    c.arc(160, 112, 958, 446, 202, 136)
    text(c, "intervention evidence updates the next task", 434, 140, 13, font="semibold", fill=CYAN_SOFT, alpha=0.88)
    glass(c, 776, 462, 260, 76, radius=16, alpha=0.13)
    text(c, "Knowledge tracing", 800, 510, 13, font="semibold", fill=CYAN)
    text(c, "P(skill_t | evidence_1:t)", 800, 486, 20, font="bold")
    footer(c, 3, "Architecture")
    c.showPage()


def learning_analytics_dashboard(c: canvas.Canvas) -> None:
    bg(c, 4, 4)
    pill(c, "Learning Analytics", 58, PAGE_H - 90, 160, CYAN)
    text(c, "Dashboard mockup: mastery, momentum, misconception risk", 58, 512, 31, font="bold")

    glass(c, 58, 88, 1036, 390, radius=22, alpha=0.12)
    glass(c, 86, 366, 210, 80, radius=16, alpha=0.16)
    glass(c, 318, 366, 210, 80, radius=16, alpha=0.16)
    glass(c, 550, 366, 210, 80, radius=16, alpha=0.16)
    glass(c, 782, 366, 280, 80, radius=16, alpha=0.16)
    metrics = [("82%", "Projected mastery", CYAN), ("+14", "Reasoning gain", MINT), ("0.31", "Risk index", AMBER), ("27 sec", "Median feedback loop", VIOLET)]
    for (big, lab, col), x in zip(metrics, [108, 340, 572, 804]):
        text(c, big, x, 407, 28, font="bold", fill=col)
        text(c, lab, x, 386, 10.5, font="semibold", fill=MUTED)

    glass(c, 86, 126, 446, 214, radius=16, alpha=0.12)
    text(c, "Class trajectory", 112, 314, 13, font="semibold", fill=CYAN)
    line_chart(c, 112, 170, 380, 108, [0.18, 0.24, 0.28, 0.38, 0.46, 0.51, 0.59, 0.64, 0.76], CYAN)
    line_chart(c, 112, 170, 380, 108, [0.16, 0.18, 0.22, 0.28, 0.30, 0.36, 0.39, 0.43, 0.49], VIOLET, False)

    glass(c, 560, 126, 236, 214, radius=16, alpha=0.12)
    text(c, "Skill heatmap", 586, 314, 13, font="semibold", fill=CYAN)
    heatmap(c, 586, 164, 178, 118, 6, 9, 4)
    text(c, "Algebra | functions | proof", 586, 144, 9.5, fill=MUTED, alpha=0.84)

    glass(c, 824, 126, 238, 214, radius=16, alpha=0.12)
    text(c, "Misconception clusters", 850, 314, 13, font="semibold", fill=CYAN)
    draw_network(c, 858, 172, 168, 96, layers=(3, 5, 4), accent=MINT)
    footer(c, 4, "Analytics")
    c.showPage()


def adaptive_assessment(c: canvas.Canvas) -> None:
    bg(c, 5, 5)
    pill(c, "Adaptive Assessment", 58, PAGE_H - 90, 170, CYAN)
    text(c, "From item response to next-best evidence", 58, 512, 34, font="bold")
    para(c, ["Select tasks that reveal reasoning, not just correctness."], 62, 468, 17, 25)

    glass(c, 70, 132, 420, 290, radius=22, alpha=0.13)
    text(c, "Assessment engine", 100, 382, 15, font="semibold", fill=CYAN)
    formulas = [
        "p(correct) = sigma(a(theta - b))",
        "utility(item) = information - burden",
        "theta_next = update(theta, evidence)",
    ]
    for i, eq in enumerate(formulas):
        glass(c, 100, 330 - i * 68, 332, 44, radius=12, alpha=0.11)
        text(c, eq, 122, 345 - i * 68, 15, font="semibold", fill=WHITE if i != 1 else CYAN_SOFT)

    glass(c, 574, 106, 462, 340, radius=22, alpha=0.12)
    text(c, "Item selection surface", 604, 406, 15, font="semibold", fill=CYAN)
    set_stroke(c, WHITE, 0.14, 0.8)
    for i in range(5):
        c.line(628, 172 + i * 42, 988, 172 + i * 42)
    for i in range(7):
        c.line(628 + i * 60, 172, 628 + i * 60, 340)
    for i in range(18):
        px = 642 + (i % 6) * 58 + (i // 6) * 10
        py = 188 + ((i * 43) % 140)
        r = 5 + (i % 4) * 2.6
        col = [CYAN, MINT, AMBER, VIOLET][i % 4]
        set_fill(c, col, 0.22)
        set_stroke(c, col, 0.85, 1)
        c.circle(px, py, r, fill=1, stroke=1)
    text(c, "diagnostic information", 757, 140, 11, fill=MUTED, align="center")
    text(c, "challenge", 598, 255, 11, fill=MUTED, align="center")
    glow_line(c, [(718, 360), (802, 336), (880, 296), (956, 236)], col=CYAN, width=1.5)
    footer(c, 5, "Assessment")
    c.showPage()


def student_model(c: canvas.Canvas) -> None:
    bg(c, 6, 6)
    pill(c, "Student Analytics", 58, PAGE_H - 90, 152, CYAN)
    text(c, "A living model of mathematical understanding", 58, 512, 34, font="bold")

    glass(c, 70, 110, 330, 354, radius=22, alpha=0.13)
    text(c, "Latent skill profile", 100, 424, 15, font="semibold", fill=CYAN)
    radar(c, 234, 270, 106, [0.76, 0.58, 0.82, 0.46, 0.67, 0.72], ["ALG", "GEO", "FUNC", "PROOF", "DATA", "META"])

    glass(c, 442, 110, 294, 354, radius=22, alpha=0.13)
    text(c, "Evidence stream", 472, 424, 15, font="semibold", fill=CYAN)
    y0 = 370
    events = [("correct proof step", MINT), ("requested hint", AMBER), ("revised equation", CYAN), ("near-transfer success", MINT), ("symbolic slip", PINK)]
    for i, (label, col) in enumerate(events):
        yy = y0 - i * 55
        set_stroke(c, col, 0.68, 1.2)
        c.line(500, yy + 16, 500, yy - 28)
        set_fill(c, col, 0.20)
        set_stroke(c, col, 0.9, 1)
        c.circle(500, yy, 7, fill=1, stroke=1)
        glass(c, 522, yy - 19, 166, 38, radius=10, alpha=0.1)
        text(c, label, 538, yy - 4, 10.5, font="semibold", fill=WHITE)

    glass(c, 780, 110, 296, 354, radius=22, alpha=0.13)
    text(c, "Adaptive signal", 810, 424, 15, font="semibold", fill=CYAN)
    gauge(c, 878, 316, 58, 0.78, "readiness", CYAN)
    gauge(c, 984, 316, 58, 0.42, "support", AMBER)
    bar_chart(c, 826, 164, 202, 84, [0.48, 0.72, 0.36, 0.84, 0.64], [CYAN, MINT, AMBER])
    text(c, "concept demand by next task", 848, 138, 10.5, fill=MUTED)
    footer(c, 6, "Student Model")
    c.showPage()


def teacher_cockpit(c: canvas.Canvas) -> None:
    bg(c, 7, 7)
    pill(c, "Teacher Cockpit", 58, PAGE_H - 90, 138, CYAN)
    text(c, "Actionable analytics for classroom orchestration", 58, 512, 33, font="bold")

    glass(c, 64, 96, 1024, 394, radius=22, alpha=0.12)
    glass(c, 92, 368, 968, 86, radius=16, alpha=0.11)
    for i, (name, pct, col) in enumerate([("Algebra", 0.82, CYAN), ("Functions", 0.67, MINT), ("Proof", 0.51, AMBER), ("Modeling", 0.74, VIOLET)]):
        x = 124 + i * 230
        text(c, name, x, 424, 12, font="semibold", fill=WHITE)
        set_fill(c, WHITE, 0.08)
        c.roundRect(x, 396, 158, 8, 4, fill=1, stroke=0)
        set_fill(c, col, 0.85)
        c.roundRect(x, 396, 158 * pct, 8, 4, fill=1, stroke=0)
        text(c, f"{int(pct*100)}%", x + 174, 392, 14, font="bold", fill=col)

    glass(c, 92, 132, 418, 206, radius=16, alpha=0.12)
    text(c, "Recommended groups", 120, 310, 13, font="semibold", fill=CYAN)
    rows = [("Group A", "linear functions", "extend"), ("Group B", "proof structure", "scaffold"), ("Group C", "symbol fluency", "practice")]
    for i, row in enumerate(rows):
        yy = 268 - i * 52
        set_stroke(c, WHITE, 0.1, 0.8)
        c.line(120, yy - 16, 478, yy - 16)
        text(c, row[0], 120, yy, 12, font="semibold")
        text(c, row[1], 230, yy, 12, fill=MUTED)
        pill(c, row[2], 390, yy - 8, 78, [MINT, AMBER, CYAN][i])

    glass(c, 542, 132, 518, 206, radius=16, alpha=0.12)
    text(c, "Class pulse", 570, 310, 13, font="semibold", fill=CYAN)
    line_chart(c, 570, 184, 218, 76, [0.22, 0.36, 0.48, 0.43, 0.60, 0.64, 0.72], CYAN)
    heatmap(c, 822, 174, 190, 90, 5, 8, 19)
    text(c, "evidence density", 862, 148, 10, fill=MUTED)
    footer(c, 7, "Teacher View")
    c.showPage()


def math_reasoning_interface(c: canvas.Canvas) -> None:
    bg(c, 8, 8)
    pill(c, "AI Tutor Interface", 58, PAGE_H - 90, 152, CYAN)
    text(c, "Supporting reasoning without hiding the mathematics", 58, 512, 32, font="bold")

    glass(c, 72, 102, 472, 374, radius=22, alpha=0.13)
    text(c, "Student work trace", 104, 432, 15, font="semibold", fill=CYAN)
    steps = [
        ("1", "2x + 5 = 17", CYAN),
        ("2", "2x = 12", MINT),
        ("3", "x = 6", MINT),
        ("4", "check: 12 + 5 = 17", AMBER),
    ]
    for i, (num, eq, col) in enumerate(steps):
        yy = 378 - i * 64
        icon_circle(c, 116, yy, num, col)
        glass(c, 154, yy - 24, 324, 48, radius=12, alpha=0.09)
        text(c, eq, 176, yy - 7, 20, font="semibold", fill=WHITE)

    glass(c, 604, 102, 464, 374, radius=22, alpha=0.13)
    text(c, "AI feedback layer", 636, 432, 15, font="semibold", fill=CYAN)
    para(c, ["Nudge: connect the inverse operation", "to both sides of the equation."], 636, 388, 18, 26, fill=WHITE, font="bold")
    glass(c, 636, 270, 356, 72, radius=14, alpha=0.1)
    text(c, "Detected concept", 660, 316, 11, font="semibold", fill=CYAN)
    text(c, "equivalence preservation", 660, 292, 21, font="bold")
    glass(c, 636, 162, 356, 72, radius=14, alpha=0.1)
    text(c, "Next move", 660, 208, 11, font="semibold", fill=CYAN)
    text(c, "ask for a verbal justification", 660, 184, 19, font="bold")
    glow_line(c, [(524, 288), (586, 288), (618, 302)], col=CYAN, width=1.6)
    footer(c, 8, "Reasoning")
    c.showPage()


def evaluation_design(c: canvas.Canvas) -> None:
    bg(c, 9, 9)
    pill(c, "Evaluation", 58, PAGE_H - 90, 104, CYAN)
    text(c, "Research design: learning impact, validity, and trust", 58, 512, 33, font="bold")

    glass(c, 70, 124, 314, 310, radius=22, alpha=0.13)
    text(c, "Learning outcomes", 102, 394, 15, font="semibold", fill=CYAN)
    bar_chart(c, 110, 208, 220, 130, [0.36, 0.58, 0.72, 0.81], [VIOLET, BLUE, CYAN, MINT])
    text(c, "pre   mid   post   transfer", 122, 178, 11, fill=MUTED)

    glass(c, 420, 124, 314, 310, radius=22, alpha=0.13)
    text(c, "Model validity", 452, 394, 15, font="semibold", fill=CYAN)
    line_chart(c, 458, 230, 218, 92, [0.18, 0.24, 0.42, 0.55, 0.63, 0.72, 0.79], MINT)
    text(c, "prediction -> observed reasoning", 460, 190, 12, fill=MUTED)
    text(c, "calibrated confidence", 460, 168, 19, font="bold")

    glass(c, 770, 124, 314, 310, radius=22, alpha=0.13)
    text(c, "Equity checks", 802, 394, 15, font="semibold", fill=CYAN)
    heatmap(c, 810, 230, 220, 92, 4, 7, 31)
    text(c, "differential support patterns", 812, 190, 12, fill=MUTED)
    text(c, "fairness by design", 812, 168, 19, font="bold")
    footer(c, 9, "Evaluation")
    c.showPage()


def responsible_ai(c: canvas.Canvas) -> None:
    bg(c, 10, 10)
    pill(c, "Responsible AI", 58, PAGE_H - 90, 138, CYAN)
    text(c, "Human-centered safeguards for educational AI", 58, 512, 34, font="bold")

    center = (576, 292)
    items = [
        ("privacy", 330, 404, CYAN),
        ("explainability", 576, 430, MINT),
        ("teacher agency", 824, 404, AMBER),
        ("bias monitoring", 824, 186, PINK),
        ("student voice", 576, 154, VIOLET),
        ("valid evidence", 330, 186, BLUE),
    ]
    for label, x, y, col in items:
        glow_line(c, [center, (x, y)], col=col, width=1)
    glass(c, center[0] - 98, center[1] - 54, 196, 108, radius=20, alpha=0.18)
    text(c, "Trustworthy", center[0], center[1] + 8, 23, font="bold", align="center")
    text(c, "AI assessment", center[0], center[1] - 20, 17, font="semibold", fill=CYAN, align="center")
    for label, x, y, col in items:
        glass(c, x - 82, y - 33, 164, 66, radius=16, alpha=0.14)
        set_fill(c, col, 0.82)
        c.circle(x - 54, y, 5, fill=1, stroke=0)
        text(c, label, x - 36, y - 5, 13.5, font="semibold")
    footer(c, 10, "Governance")
    c.showPage()


def roadmap(c: canvas.Canvas) -> None:
    bg(c, 11, 11)
    pill(c, "Implementation Roadmap", 58, PAGE_H - 90, 196, CYAN)
    text(c, "Building the adaptive learning analytics stack", 58, 512, 33, font="bold")

    phases = [
        ("01", "Instrument", "capture reasoning traces", CYAN),
        ("02", "Model", "estimate mastery states", BLUE),
        ("03", "Orchestrate", "recommend interventions", MINT),
        ("04", "Evaluate", "close the research loop", AMBER),
    ]
    y = 300
    for i, (num, title, sub, col) in enumerate(phases):
        x = 120 + i * 250
        set_stroke(c, col, 0.35, 2)
        if i < len(phases) - 1:
            glow_line(c, [(x + 96, y), (x + 214, y)], col=phases[i + 1][3], width=1.4)
        glass(c, x - 44, y - 92, 168, 184, radius=20, alpha=0.14)
        text(c, num, x + 40, y + 45, 34, font="bold", fill=col, align="center")
        text(c, title, x + 40, y - 2, 20, font="bold", align="center")
        text(c, sub, x + 40, y - 32, 10.5, fill=MUTED, align="center")
    glass(c, 212, 94, 730, 62, radius=16, alpha=0.12)
    text(c, "Principle: optimize for interpretability, classroom usefulness, and measurable learning.", 576, 118, 17, font="semibold", fill=WHITE, align="center")
    footer(c, 11, "Roadmap")
    c.showPage()


def closing(c: canvas.Canvas) -> None:
    bg(c, 12, 12)
    pill(c, "Closing Thesis", 58, PAGE_H - 90, 138, CYAN)
    text(c, "From static assessment\nto adaptive learning ecosystems", 58, 408, 42, font="bold", leading=48)
    para(c, ["AI becomes valuable when it makes mathematical thinking", "more visible, discussable, and actionable."], 62, 296, 19, 28, fill=WHITE, font="semibold")
    glass(c, 692, 126, 344, 372, radius=24, alpha=0.12)
    draw_network(c, 750, 250, 230, 150, layers=(4, 7, 6, 3), accent=CYAN)
    draw_hud_orbit(c, 864, 324, 112)
    text(c, "learning evidence", 781, 188, 14, font="semibold", fill=CYAN_SOFT)
    text(c, "-> better decisions", 781, 164, 20, font="bold")
    footer(c, 12, "Closing")
    c.showPage()


def build() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(PDF_PATH), pagesize=(PAGE_W, PAGE_H))
    c.setTitle("Adaptive Intelligence for Mathematical Learning")
    c.setAuthor("Generated by Codex")
    slides = [
        title_slide,
        research_problem,
        system_architecture,
        learning_analytics_dashboard,
        adaptive_assessment,
        student_model,
        teacher_cockpit,
        math_reasoning_interface,
        evaluation_design,
        responsible_ai,
        roadmap,
        closing,
    ]
    for slide in slides:
        slide(c)
    c.save()

    try:
        import fitz

        doc = fitz.open(str(PDF_PATH))
        pix = doc[0].get_pixmap(matrix=fitz.Matrix(1.2, 1.2), alpha=False)
        pix.save(str(PREVIEW_PATH))
    except Exception:
        first_bg = Image.open(background(1, 1)).resize((1280, 720))
        first_bg.save(PREVIEW_PATH)


if __name__ == "__main__":
    build()
    print(f"Wrote {PDF_PATH}")
    print(f"Wrote {PREVIEW_PATH}")
