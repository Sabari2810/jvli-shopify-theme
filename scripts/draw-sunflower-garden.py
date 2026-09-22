"""Draws assets/jvli-sunflower-garden.svg: a gold line-sketch row of
sunflowers, buds and grass. The tile repeats horizontally along the bottom
of the footer, so nothing crosses its left or right edge.

Run: python3 scripts/draw-sunflower-garden.py
"""
import math
import random
from pathlib import Path

W, H = 1200, 240        # tile size; the ground line is at the bottom
GOLD = "#c9a35d"
random.seed(11)


def n(v):
    return f"{v:.1f}"


def flower_head(cx, cy, r_in, r_out, tilt):
    """Front-facing sunflower head, squashed a little by `tilt` (0 = flat on)."""
    out = []
    sy = 1 - tilt
    pt = lambda a, r: (cx + r * math.cos(a), cy + r * math.sin(a) * sy)
    for ring, (count, rot, r_tip, w) in enumerate([(16, 0, r_out, 0.18), (16, math.pi / 16, r_out * 0.86, 0.17)]):
        for i in range(count):
            a = rot + i * 2 * math.pi / count + random.uniform(-0.05, 0.05)
            tip_r = r_tip * random.uniform(0.92, 1.06)
            bl, br = pt(a - w * 1.6, r_in), pt(a + w * 1.6, r_in)
            mid = r_in + (tip_r - r_in) * 0.55
            c1, c2 = pt(a - w * 1.25, mid), pt(a + w * 1.25, mid)
            tip = pt(a, tip_r)
            cls = ' class="t"' if ring == 1 else ''
            out.append(f'<path{cls} d="M{n(bl[0])} {n(bl[1])} Q{n(c1[0])} {n(c1[1])} {n(tip[0])} {n(tip[1])} '
                       f'Q{n(c2[0])} {n(c2[1])} {n(br[0])} {n(br[1])}"/>')
    out.append(f'<ellipse cx="{n(cx)}" cy="{n(cy)}" rx="{n(r_in)}" ry="{n(r_in * sy)}"/>')
    out.append(f'<ellipse class="t" cx="{n(cx)}" cy="{n(cy)}" rx="{n(r_in * 0.7)}" ry="{n(r_in * 0.7 * sy)}"/>')
    golden = math.pi * (3 - math.sqrt(5))
    step = r_in / 11
    for k in range(1, 200):
        r = step * math.sqrt(k) * 1.6
        if r > r_in - step * 1.5:
            break
        a = k * golden
        out.append(f'<circle class="d" cx="{n(cx + r * math.cos(a))}" cy="{n(cy + r * math.sin(a) * sy)}" r="{n(max(0.9, r_in / 26))}"/>')
    return out


def leaf(x, y, length, side, lift):
    """A pointed leaf leaving the stem at (x, y) towards `side` (-1 left, 1 right)."""
    tx, ty = x + side * length, y - lift
    c1 = (x + side * length * 0.35, y - lift - length * 0.28)
    c2 = (x + side * length * 0.55, y - lift * 0.2 + length * 0.18)
    vein_end = (x + side * length * 0.9, y - lift * 0.95)
    return [f'<path d="M{n(x)} {n(y)} C{n(c1[0])} {n(c1[1])} {n(tx - side * length * 0.1)} {n(ty - length * 0.08)} {n(tx)} {n(ty)} '
            f'C{n(tx - side * length * 0.2)} {n(ty + length * 0.12)} {n(c2[0])} {n(c2[1])} {n(x)} {n(y)}Z"/>',
            f'<path class="t" d="M{n(x + side * 3)} {n(y - 1)} Q{n(x + side * length * 0.5)} {n(y - lift * 0.55 - 3)} {n(vein_end[0])} {n(vein_end[1])}"/>']


def sunflower(x, height, head_r, lean):
    """Stem from the ground at x, curving by `lean`, with a head at the top."""
    out = []
    top_x, top_y = x + lean, H - height
    sway = random.uniform(-10, 10)
    out.append(f'<path d="M{n(x)} {H} C{n(x + sway)} {n(H - height * 0.35)} {n(top_x - lean * 0.6 - sway)} {n(top_y + height * 0.45)} {n(top_x)} {n(top_y + head_r * 0.9)}"/>')
    # leaves at two heights, alternating sides
    side = random.choice([-1, 1])
    for frac in (0.3, 0.55):
        ly = H - height * frac
        lx = x + (top_x - x) * frac * 0.8
        out += leaf(lx, ly, head_r * random.uniform(1.1, 1.45), side, head_r * 0.45)
        side = -side
    tilt = random.uniform(0.05, 0.25)
    out += flower_head(top_x, top_y, head_r * 0.38, head_r, tilt)
    return out


def bud(x, height, lean):
    top_x, top_y = x + lean, H - height
    return [f'<path d="M{n(x)} {H} Q{n(x + lean * 0.2)} {n(H - height * 0.5)} {n(top_x)} {n(top_y + 9)}"/>',
            f'<path d="M{n(top_x - 7)} {n(top_y + 9)} Q{n(top_x - 8)} {n(top_y - 4)} {n(top_x)} {n(top_y - 10)} '
            f'Q{n(top_x + 8)} {n(top_y - 4)} {n(top_x + 7)} {n(top_y + 9)} Q{n(top_x)} {n(top_y + 13)} {n(top_x - 7)} {n(top_y + 9)}Z"/>',
            f'<path class="t" d="M{n(top_x)} {n(top_y - 8)} L{n(top_x)} {n(top_y + 10)}"/>']


def grass(x0, x1):
    out = []
    x = x0
    while x < x1:
        h = random.uniform(8, 26)
        bend = random.uniform(-7, 7)
        out.append(f'<path class="t" d="M{n(x)} {H} Q{n(x + bend * 0.3)} {n(H - h * 0.6)} {n(x + bend)} {n(H - h)}"/>')
        x += random.uniform(5, 13)
    return out


parts = []
parts += grass(6, W - 6)
# (x, stem height, head radius, lean) — tall and short flowers mixed
for x, h, r, lean in [(70, 150, 34, -8), (190, 184, 42, 10), (300, 120, 28, 4), (420, 180, 38, -12),
                      (560, 140, 31, 8), (690, 186, 44, -6), (820, 128, 29, 12), (940, 190, 40, -9),
                      (1070, 150, 33, 6)]:
    parts += sunflower(x, h, r, lean)
for x, h, lean in [(128, 96, 6), (360, 88, -5), (620, 102, 7), (880, 84, -6), (1136, 98, -4)]:
    parts += bud(x, h, lean)

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" fill="none" stroke="{GOLD}" '
       'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" preserveAspectRatio="xMidYMax meet">'
       f'<style>.t{{stroke-width:1.2;opacity:.75}}.d{{fill:{GOLD};stroke:none}}</style>'
       + "".join(parts) + "</svg>\n")
out = Path(__file__).resolve().parent.parent / "assets" / "jvli-sunflower-garden.svg"
out.write_text(svg)
print(f"wrote {out} ({len(svg)} bytes)")
