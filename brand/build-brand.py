"""Generate the ExThrifts logo set from one letter geometry.

Every mark is built from GLYPH() below: condensed bold capitals on a 100-unit
cap height, drawn as filled polygons (straight letters) and fixed-width stroked
centrelines (the rounded S, G, P, R bowls). Nothing uses <text>, so the files
render identically everywhere with no font installed. Pure #000 / #fff only.

Run:   python brand/build-brand.py      -> brand/*.svg, brand/png-src/*.svg + manifest.json
Then:  node brand/export-png.mjs        -> every PNG listed in png-src/manifest.json
"""
import json
import math
import random
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / "png-src"
SRC.mkdir(exist_ok=True)

BLACK = "#000"
WHITE = "#fff"
NAME = "ExThrifts"


def n(v):
    """Compact number for path data."""
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def poly(pts):
    """Closed polygon, normalised to clockwise (screen) so overlapping parts union under nonzero."""
    area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))
    if area < 0:
        pts = pts[::-1]
    return "M" + " L".join(f"{n(x)},{n(y)}" for x, y in pts) + " Z"


def circle(cx, cy, r):
    return (
        f"M{n(cx - r)},{n(cy)} a{n(r)},{n(r)} 0 1 0 {n(2 * r)},0 "
        f"a{n(r)},{n(r)} 0 1 0 {n(-2 * r)},0 Z"
    )


def star_pts(cx, cy, r, inner=0.42, rot=-90):
    pts = []
    for i in range(10):
        rr = r if i % 2 == 0 else r * inner
        a = math.radians(rot + i * 36)
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


class Glyph:
    def __init__(self, width, fills=(), strokes=(), t=20.0):
        self.width = width
        self.fills = list(fills)
        self.strokes = list(strokes)
        self.t = t


def GLYPH(ch, t=20.0, w=None, k=None):
    """One capital on a 100-unit cap height, origin top-left, baseline y=100.

    t  = stem weight. Diagonals are k = 1.2t wide horizontally so they look as
    heavy as the verticals; curved letters run a t-wide stroke round corners of
    centreline radius rc. w and k override the width / diagonal weight of E and X
    (used by the pixel-fitted favicon).
    """
    h = t / 2
    k = k or t * 1.2
    rc = t * 0.8
    mid = 50
    if ch == "E":
        w = w or 50
        return Glyph(w, [poly([(0, 0), (w, 0), (w, t), (t, t), (t, mid - t / 2), (w - 5, mid - t / 2),
                               (w - 5, mid + t / 2), (t, mid + t / 2), (t, 100 - t), (w, 100 - t),
                               (w, 100), (0, 100)])], t=t)
    if ch == "F":
        w = 48
        return Glyph(w, [poly([(0, 0), (w, 0), (w, t), (t, t), (t, mid - t / 2), (w - 5, mid - t / 2),
                               (w - 5, mid + t / 2), (t, mid + t / 2), (t, 100), (0, 100)])], t=t)
    if ch == "T":
        w = 54
        a, b = (w - t) / 2, (w + t) / 2
        return Glyph(w, [poly([(0, 0), (w, 0), (w, t), (b, t), (b, 100), (a, 100), (a, t), (0, t)])], t=t)
    if ch == "H":
        w = 58
        return Glyph(w, [poly([(0, 0), (t, 0), (t, mid - t / 2), (w - t, mid - t / 2), (w - t, 0), (w, 0),
                               (w, 100), (w - t, 100), (w - t, mid + t / 2), (t, mid + t / 2), (t, 100),
                               (0, 100)])], t=t)
    if ch == "I":
        return Glyph(t, [poly([(0, 0), (t, 0), (t, 100), (0, 100)])], t=t)
    if ch == "N":
        w = 60
        y1 = 100 * (w - t - k) / (w - k)
        y2 = 100 * t / (w - k)
        return Glyph(w, [poly([(0, 0), (k, 0), (w - t, y1), (w - t, 0), (w, 0), (w, 100), (w - k, 100),
                               (t, y2), (t, 100), (0, 100)])], t=t)
    if ch == "V":
        w = 62
        cx, f = w / 2, k * 0.85
        yi = 100 * (cx - k) / (cx - f / 2)
        return Glyph(w, [poly([(0, 0), (k, 0), (cx, yi), (w - k, 0), (w, 0), (cx + f / 2, 100),
                               (cx - f / 2, 100)])], t=t)
    if ch == "X":
        # Single non-self-intersecting outline (so it can also be knocked out with evenodd).
        w = w or 62
        yt = 100 * (w / 2 - k) / (w - k)
        return Glyph(w, [poly([(0, 0), (k, 0), (w / 2, yt), (w - k, 0), (w, 0), ((w + k) / 2, 50),
                               (w, 100), (w - k, 100), (w / 2, 100 - yt), (k, 100), (0, 100),
                               ((w - k) / 2, 50)])], t=t)
    if ch == "A":
        w, ax = 64, 12
        y1, y2 = 60, 60 + t * 0.8
        xo = ax * (1 - y1 / 100)
        return Glyph(w, [
            poly([(0, 100), (ax, 0), (ax + k, 0), (k, 100)]),
            poly([(w - k, 100), (w - ax - k, 0), (w - ax, 0), (w, 100)]),
            poly([(xo, y1), (w - xo, y1), (w - xo, y2), (xo, y2)]),
        ], t=t)
    if ch == "K":
        w = 58
        yb = 62
        ya = yb * (w - k - t) / (w - t)
        x2, y2 = t * 0.7, 30
        return Glyph(w, [
            poly([(0, 0), (t, 0), (t, 100), (0, 100)]),
            poly([(w - k, 0), (w, 0), (t, yb), (t, ya)]),
            poly([(x2, y2), (x2 + k, y2), (w, 100), (w - k, 100)]),
        ], t=t)
    if ch == "S":
        w = max(56, 2 * (h + rc) + 8)
        d = (f"M{n(w)},{n(h)} H{n(h + rc)} A{n(rc)},{n(rc)} 0 0 0 {n(h)},{n(h + rc)} "
             f"V{n(mid - rc)} A{n(rc)},{n(rc)} 0 0 0 {n(h + rc)},{n(mid)} H{n(w - h - rc)} "
             f"A{n(rc)},{n(rc)} 0 0 1 {n(w - h)},{n(mid + rc)} V{n(100 - h - rc)} "
             f"A{n(rc)},{n(rc)} 0 0 1 {n(w - h - rc)},{n(100 - h)} H0")
        return Glyph(w, strokes=[d], t=t)
    if ch == "G":
        w = 58
        d = (f"M{n(w)},{n(h)} H{n(h + rc)} A{n(rc)},{n(rc)} 0 0 0 {n(h)},{n(h + rc)} "
             f"V{n(100 - h - rc)} A{n(rc)},{n(rc)} 0 0 0 {n(h + rc)},{n(100 - h)} H{n(w - h)} "
             f"V{n(52)} H{n(w * 0.52)}")
        return Glyph(w, strokes=[d], t=t)
    if ch in "PR":
        w = 56 if ch == "P" else 58
        yb = 58 if ch == "P" else 56
        d = (f"M{n(h)},100 V{n(h)} H{n(w - h - rc)} A{n(rc)},{n(rc)} 0 0 1 {n(w - h)},{n(h + rc)} "
             f"V{n(yb - rc)} A{n(rc)},{n(rc)} 0 0 1 {n(w - h - rc)},{n(yb)} H{n(h)}")
        fills = []
        if ch == "R":
            xa = w * 0.42 - k / 2
            fills.append(poly([(xa, yb - h), (xa + k, yb - h), (w, 100), (w - k, 100)]))
        return Glyph(w, fills, [d], t=t)
    if ch == "·":
        r = t * 0.55
        return Glyph(2 * r, [circle(r, mid, r)], t=t)
    if ch == "*":
        r = 34
        return Glyph(2 * r, [poly(star_pts(r, mid + 2, r))], t=t)
    if ch == " ":
        return Glyph(14, t=t)
    raise KeyError(ch)


def glyph_svg(g, transform, color):
    """One positioned glyph as SVG elements."""
    out = []
    if g.fills:
        out.append(f'<path d="{" ".join(g.fills)}"/>')
    if g.strokes:
        out.append(f'<path fill="none" stroke="{color}" stroke-width="{n(g.t)}" '
                   f'stroke-linejoin="miter" stroke-miterlimit="4" d="{" ".join(g.strokes)}"/>')
    return f'<g transform="{transform}">{"".join(out)}</g>' if out else ""


def run(text, t=20.0, track=8.0):
    """Lay text out on a straight line. Returns ([(glyph, x)], width) in cap-100 units."""
    items, x = [], 0.0
    for i, ch in enumerate(text):
        g = GLYPH(ch, t)
        items.append((g, x))
        x += g.width + (track if i < len(text) - 1 else 0)
    return items, x


def line_text(text, x, y, cap, color, t=20.0, track=8.0, anchor="start"):
    """Straight text; (x, y) is the top-left of the cap box (or top-centre with anchor='middle')."""
    items, width = run(text, t, track)
    s = cap / 100
    if anchor == "middle":
        x -= width * s / 2
    body = "".join(glyph_svg(g, f"translate({n(x + gx * s)} {n(y)}) scale({n(s)})", color) for g, gx in items)
    return f'<g fill="{color}">{body}</g>', width * s


def arc_text(text, cx, cy, r_mid, cap, color, span_deg, t=20.0, top=True):
    """Text round a circle centred on 12 o'clock (top=True, letters face out)
    or 6 o'clock (top=False, letters upright, reading left to right).

    Letters are spaced by arc length on r_mid, the middle of the cap height;
    the tracking is solved so the run fills span_deg exactly.
    """
    s = cap / 100
    glyphs = [GLYPH(ch, t) for ch in text]
    widths = [g.width * s for g in glyphs]
    arc = r_mid * math.radians(span_deg)
    gap = (arc - sum(widths)) / (len(glyphs) - 1)
    out, pos = [], 0.0
    for g, w in zip(glyphs, widths):
        a = math.degrees((pos + w / 2) / r_mid)
        if top:
            ang, tr = -span_deg / 2 + a, f"translate(0 {n(-(r_mid - cap / 2))})"
        else:
            ang, tr = span_deg / 2 - a, f"translate(0 {n(r_mid + cap / 2)})"
        out.append(glyph_svg(
            g, f"translate({n(cx)} {n(cy)}) rotate({n(ang)}) {tr} scale({n(s)}) translate({n(-g.width / 2)} -100)",
            color))
        pos += w + gap
    return f'<g fill="{color}">{"".join(out)}</g>', gap / s


def ring(cx, cy, r_out, r_in, color):
    return f'<path fill="{color}" fill-rule="evenodd" d="{circle(cx, cy, r_out)} {circle(cx, cy, r_in)}"/>'


def svg(w, h, body, title=NAME):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n(w)} {n(h)}" role="img" '
            f'aria-label="{title}"><title>{title}</title>{body}</svg>\n')


def transform_path(d, tx, ty, s):
    """Apply translate + uniform scale to a polygon path made only of absolute M/L/Z points."""
    out = []
    for tok in d.replace("M", "M ").replace("L", "L ").split():
        if tok in ("M", "L", "Z"):
            out.append(tok)
        else:
            x, y = (float(v) for v in tok.split(","))
            out.append(f"{n(tx + x * s)},{n(ty + y * s)}")
    return " ".join(out).replace("M ", "M").replace("L ", "L")


# ---------------------------------------------------------------- stamp
# 1000 x 1000, centre 500. Radii (outer, inner) from the outside in.
STAMP = dict(
    outer=(496, 466),      # heavy outer ring
    rule1=(456, 449),      # thin rule
    band_mid=391,          # middle of the lettering band
    rule2=(333, 326),      # thin rule
    inner=(316, 296),      # inner ring round the EX
)
TOP_TEXT, TOP_CAP, TOP_SPAN = "EXTHRIFTS", 96, 122
BOT_TEXT, BOT_CAP, BOT_SPAN = "VINTAGE · THRIFT · PAKISTAN", 62, 134


def stamp(color, cx=500, cy=500):
    S = STAMP
    parts = [ring(cx, cy, *S["outer"], color), ring(cx, cy, *S["rule1"], color),
             ring(cx, cy, *S["rule2"], color), ring(cx, cy, *S["inner"], color)]
    parts.append(arc_text(TOP_TEXT, cx, cy, S["band_mid"], TOP_CAP, color, TOP_SPAN, t=23, top=True)[0])
    parts.append(arc_text(BOT_TEXT, cx, cy, S["band_mid"], BOT_CAP, color, BOT_SPAN, t=20, top=False)[0])
    # Separators where the two runs meet, at 9 and 3 o'clock.
    stars = " ".join(poly(star_pts(cx + sx * S["band_mid"], cy, 30)) for sx in (-1, 1))
    parts.append(f'<path fill="{color}" d="{stars}"/>')
    # Centre: EX between two short rules, each broken by a star.
    cap = 232
    parts.append(line_text("EX", cx, cy - cap / 2, cap, color, t=22, track=10, anchor="middle")[0])
    r_inner = S["inner"][1]
    marks = []
    for sy in (-1, 1):
        y = cy + sy * (cap / 2 + 44)
        half = math.sqrt(r_inner ** 2 - (y - cy) ** 2) - 44
        th, gap = 9, 34
        marks.append(poly([(cx - half, y - th / 2), (cx - gap, y - th / 2), (cx - gap, y + th / 2), (cx - half, y + th / 2)]))
        marks.append(poly([(cx + gap, y - th / 2), (cx + half, y - th / 2), (cx + half, y + th / 2), (cx + gap, y + th / 2)]))
        marks.append(poly(star_pts(cx, y + 1, 21)))
    parts.append(f'<path fill="{color}" d="{" ".join(marks)}"/>')
    return "".join(parts)


def wear_mask(seed=11):
    """Deterministic ink wear: specks and scratches cut out of the stamp. Mask values are 0 or 1 only."""
    rnd = random.Random(seed)
    holes = []
    for _ in range(950):
        r = 496 * math.sqrt(rnd.random())
        a = rnd.random() * math.tau
        holes.append(circle(500 + r * math.cos(a), 500 + r * math.sin(a), rnd.uniform(1.2, 3.4)))
    # Heavier wear clusters on the outer ring only, where a hand stamp loses ink first; kept off
    # the lettering band so every word still reads.
    for _ in range(16):
        a0 = rnd.random() * math.tau
        r0 = rnd.uniform(468, 492)
        for _ in range(rnd.randint(18, 40)):
            a = a0 + rnd.gauss(0, 0.07)
            r = r0 + rnd.gauss(0, 8)
            holes.append(circle(500 + r * math.cos(a), 500 + r * math.sin(a), rnd.uniform(2, 7)))
    # A few hairline scratches.
    for _ in range(5):
        x, y = rnd.uniform(150, 850), rnd.uniform(150, 850)
        a = rnd.uniform(0, math.pi)
        L, w = rnd.uniform(80, 200), rnd.uniform(1.4, 2.4)
        dx, dy = math.cos(a) * L / 2, math.sin(a) * L / 2
        px, py = -math.sin(a) * w / 2, math.cos(a) * w / 2
        holes.append(poly([(x - dx + px, y - dy + py), (x + dx + px, y + dy + py),
                           (x + dx - px, y + dy - py), (x - dx - px, y - dy - py)]))
    return ('<mask id="wear" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">'
            '<rect width="1000" height="1000" fill="#fff"/>'
            f'<path fill="#000" d="{" ".join(holes)}"/></mask>')


# ---------------------------------------------------------------- tag
# Woven-label lockup: double-ruled frame, solid block with EX cut out, then THRIFTS. Height 120.
TAG_H = 120


def tag(color):
    H = TAG_H
    cap, t = 52, 21
    s = cap / 100
    ex_items, ex_w = run("EX", t, 8)
    th_items, th_w = run("THRIFTS", t, 9)
    pad_block = 14
    block_x, block_y, block_h = 23, 23, H - 46
    block_w = ex_w * s + 2 * pad_block
    text_x = block_x + block_w + 20
    W = text_x + th_w * s + 20 + 23
    y = (H - cap) / 2
    frame = poly([(0, 0), (W, 0), (W, H), (0, H)]) + " " + poly([(8, 8), (W - 8, 8), (W - 8, H - 8), (8, H - 8)])
    rule = (poly([(14, 14), (W - 14, 14), (W - 14, H - 14), (14, H - 14)]) + " "
            + poly([(18, 18), (W - 18, 18), (W - 18, H - 18), (18, H - 18)]))
    # E and X are single polygons, so evenodd cuts them cleanly out of the block.
    x0 = block_x + pad_block
    ex_paths = [transform_path(d, x0 + gx * s, y, s) for g, gx in ex_items for d in g.fills]
    block = poly([(block_x, block_y), (block_x + block_w, block_y), (block_x + block_w, block_y + block_h),
                  (block_x, block_y + block_h)])
    th = "".join(glyph_svg(g, f"translate({n(text_x + gx * s)} {n(y)}) scale({n(s)})", color) for g, gx in th_items)
    body = (f'<path fill="{color}" fill-rule="evenodd" d="{frame} {rule}"/>'
            f'<path fill="{color}" fill-rule="evenodd" d="{block} {" ".join(ex_paths)}"/>'
            f'<g fill="{color}">{th}</g>')
    return W, H, body


# ---------------------------------------------------------------- monogram
def ex_mark(cx, cy, cap, t=24, track=7, e_w=None, x_w=None, x_k=None):
    """EX centred on (cx, cy) as plain polygon path data."""
    e, x = GLYPH("E", t, w=e_w), GLYPH("X", t, w=x_w, k=x_k)
    items, w = [(e, 0), (x, e.width + track)], e.width + track + x.width
    s = cap / 100
    x0, y0 = cx - w * s / 2, cy - cap / 2
    return " ".join(transform_path(d, x0 + gx * s, y0, s) for g, gx in items for d in g.fills)


def monogram_knockout(color, size=200):
    """Solid disc with a ring rule and EX cut out (transparent)."""
    c = size / 2
    d = " ".join([circle(c, c, c), circle(c, c, c * 0.885), circle(c, c, c * 0.83),
                  ex_mark(c, c, size * 0.38, t=23)])
    return f'<path fill="{color}" fill-rule="evenodd" d="{d}"/>'


def mark_painted(cx, cy, R, disc=True, ring_rule=True, cap_ratio=0.38, t=23, **ex):
    """Black disc (optional) with the ring rule and EX painted white."""
    parts = []
    if disc:
        parts.append(f'<path fill="{BLACK}" d="{circle(cx, cy, R)}"/>')
    if ring_rule:
        parts.append(ring(cx, cy, R * 0.885, R * 0.83, WHITE))
    parts.append(f'<path fill="{WHITE}" d="{ex_mark(cx, cy, 2 * R * cap_ratio, t=t, **ex)}"/>')
    return "".join(parts)


# ---------------------------------------------------------------- write
files = {}
manifest = []


def add_png(src_name, src_svg, vb_w, out, width, height=None, background=None):
    (SRC / src_name).write_text(src_svg, encoding="utf-8")
    manifest.append({"src": f"png-src/{src_name}", "viewBoxWidth": vb_w, "out": out,
                     "width": width, "height": height or width, "background": background})


files["stamp.svg"] = svg(1000, 1000, stamp(BLACK))
files["stamp-white.svg"] = svg(1000, 1000, stamp(WHITE))
files["stamp-distressed.svg"] = svg(1000, 1000, f'<defs>{wear_mask()}</defs><g mask="url(#wear)">{stamp(BLACK)}</g>')

tw, th, tb = tag(BLACK)
files["tag.svg"] = svg(tw, th, tb)
files["tag-white.svg"] = svg(tw, th, tag(WHITE)[2])

files["monogram.svg"] = svg(200, 200, monogram_knockout(BLACK))
files["monogram-white.svg"] = svg(200, 200, monogram_knockout(WHITE))

# Favicon: no ring (it turns to mush below 32 px), painted white so it reads on light and dark
# browser chrome. Fitted to the 16 px grid (12.5 units = 1 px): cap 8 px, stems 2 px, E counters
# 1 px, E 4 px + 1 px gap + X 5 px with lighter diagonals so the X keeps its notches. 32 px = 2x.
files["favicon.svg"] = svg(200, 200, mark_painted(100, 100, 100, ring_rule=False, cap_ratio=0.5, t=25,
                                                  track=12.5, e_w=50, x_w=62.5, x_k=22))

# Plain wordmark (no tagline) for the OG image and anywhere a frame is too busy.
wm, wm_w = line_text("EXTHRIFTS", 0, 0, 100, BLACK, t=21, track=10)
files["wordmark.svg"] = svg(wm_w, 100, wm)

for name, content in files.items():
    (HERE / name).write_text(content, encoding="utf-8")

# Raster sources, kept in png-src/ so every PNG is reproducible from the geometry above.
add_png("favicon.svg", files["favicon.svg"], 200, "favicon-32.png", 32)
apple = svg(180, 180, f'<rect width="180" height="180" fill="{BLACK}"/>' + mark_painted(90, 90, 74, disc=False))
add_png("apple-touch-icon.svg", apple, 180, "apple-touch-icon.png", 180)
icon = svg(512, 512, mark_painted(256, 256, 256))
add_png("icon.svg", icon, 512, "icon-192.png", 192)
add_png("icon.svg", icon, 512, "icon-512.png", 512)
# Maskable: full-bleed black; ring outer edge at 0.708 of the canvas, inside the 0.8 safe circle.
maskable = svg(512, 512, f'<rect width="512" height="512" fill="{BLACK}"/>' + mark_painted(256, 256, 512 * 0.4, disc=False))
add_png("maskable.svg", maskable, 512, "maskable-512.png", 512)

# Open Graph 1200 x 630: stamp left, wordmark right, white ground.
og_stamp = 470
og_s = og_stamp / 1000
og_wm_x = 80 + og_stamp + 70
og_wm_s = (1200 - 80 - og_wm_x) / wm_w
og = svg(1200, 630,
         f'<rect width="1200" height="630" fill="{WHITE}"/>'
         f'<g transform="translate(80 {n((630 - og_stamp) / 2)}) scale({n(og_s)})">{stamp(BLACK)}</g>'
         f'<g transform="translate({n(og_wm_x)} {n(315 - 50 * og_wm_s)}) scale({n(og_wm_s)})">{wm}</g>')
add_png("og-image.svg", og, 1200, "og-image.png", 1200, 630, background=WHITE)

# Convenience rasters of the two main marks (black on transparent) for tools that cannot take SVG.
add_png("stamp.svg", files["stamp.svg"], 1000, "stamp-1200.png", 1200)
add_png("tag.svg", files["tag.svg"], tw, "tag-240h.png", round(240 * tw / th), 240)

# Android adaptive icon: 108dp canvas, white art inside the 66dp safe circle on a black (#000000)
# background layer. Ring outer edge = 0.602 of the canvas, inside 66/108 = 0.611.
fg = svg(432, 432, mark_painted(216, 216, 432 * 0.34, disc=False))
add_png("android-foreground.svg", fg, 432, "android/ic_launcher_foreground.png", 432)
for dpi, px in [("mdpi", 108), ("hdpi", 162), ("xhdpi", 216), ("xxhdpi", 324), ("xxxhdpi", 432)]:
    add_png("android-foreground.svg", fg, 432, f"android/mipmap-{dpi}/ic_launcher_foreground.png", px)
# Legacy (pre-adaptive) launcher icons: black disc mark on transparent.
for dpi, px in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]:
    add_png("icon.svg", icon, 512, f"android/mipmap-{dpi}/ic_launcher.png", px)
    add_png("icon.svg", icon, 512, f"android/mipmap-{dpi}/ic_launcher_round.png", px)

(SRC / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(f"wrote {len(files)} SVGs to {HERE} and {len(manifest)} PNG jobs to {SRC / 'manifest.json'}")
