"""Link preview images: each product as a polaroid on paper.

Reads the store's public product list (/products.json), draws a 1200 x 630
JPEG per product (photo in a taped polaroid, the name handwritten under it,
the JVLI mark and the price beside it) into assets/jvli-og-<handle>.jpg, and
lists the handles that have one in snippets/jvli-og-handles.liquid, which
snippets/meta-tags.liquid reads. Files are only rewritten when they change,
and images for products that are gone are removed.

Run by .github/workflows/og-images.yml. Fonts are passed in as paths.

  python tools/og/make_og.py --store https://thejvlistore.in --theme . \
      --serif Newsreader.ttf --hand NothingYouCouldDo.ttf --caps Jost.ttf
"""
import argparse
import io
import json
import math
import os
import random
import re
import urllib.request

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
PAPER = (243, 236, 225)
INK = (42, 33, 28)
PEN = (92, 70, 54)
MAROON = (118, 53, 48)
CARD = (250, 247, 241)
UA = "Mozilla/5.0 (compatible; JVLI link previews)"


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def products(store):
    items, page = [], 1
    while True:
        data = json.loads(fetch(f"{store}/products.json?limit=250&page={page}"))
        batch = data.get("products", [])
        items += batch
        if len(batch) < 250:
            return items
        page += 1


def cover(image, size):
    """Crop to fill `size`, keeping the top (faces) rather than the middle."""
    w, h = image.size
    tw, th = size
    scale = max(tw / w, th / h)
    image = image.resize((max(tw, round(w * scale)), max(th, round(h * scale))), Image.LANCZOS)
    left = (image.width - tw) // 2
    top = min((image.height - th) // 4, image.height - th)
    return image.crop((left, top, left + tw, top + th))


def price_text(product):
    prices = [float(v["price"]) for v in product.get("variants", []) if v.get("price")]
    if not prices:
        return ""
    low = min(prices)
    text = f"{low:,.0f}"
    # Indian grouping: 1,23,456
    digits = f"{int(round(low))}"
    if len(digits) > 3:
        head, tail = digits[:-3], digits[-3:]
        head = re.sub(r"(\d)(?=(\d\d)+$)", r"\1,", head)
        text = f"{head},{tail}"
    return ("From " if len(set(prices)) > 1 else "") + "₹" + text


def fit(draw, text, font_path, max_width, start, low):
    size = start
    while size > low:
        font = ImageFont.truetype(font_path, size)
        if draw.textlength(text, font=font) <= max_width:
            return font
        size -= 1
    return ImageFont.truetype(font_path, low)


def wrap(draw, text, font, max_width, lines=2):
    words, out, line = text.split(), [], ""
    for word in words:
        trial = (line + " " + word).strip()
        if draw.textlength(trial, font=font) <= max_width or not line:
            line = trial
        else:
            out.append(line)
            line = word
    out.append(line)
    if len(out) > lines:
        out = out[:lines]
        while draw.textlength(out[-1] + "…", font=font) > max_width and " " in out[-1]:
            out[-1] = out[-1].rsplit(" ", 1)[0]
        out[-1] += "…"
    return out


def paper(seed):
    rng = random.Random(seed)
    base = Image.new("RGB", (W, H), PAPER)
    # Soft window light from the top left, a little shade bottom right.
    glow = Image.new("L", (W, H), 0)
    g = ImageDraw.Draw(glow)
    g.ellipse((-300, -380, 900, 520), fill=90)
    g.ellipse((700, 300, 1600, 1000), fill=0)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    base = Image.composite(Image.new("RGB", (W, H), (250, 245, 236)), base, glow)
    shade = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shade).ellipse((760, 260, 1500, 900), fill=60)
    shade = shade.filter(ImageFilter.GaussianBlur(170))
    base = Image.composite(Image.new("RGB", (W, H), (226, 216, 200)), base, shade)
    # Paper grain.
    noise = Image.effect_noise((W, H), 18).convert("L")
    grain = Image.merge("RGB", (noise, noise, noise))
    base = Image.blend(base, Image.composite(grain, base, Image.new("L", (W, H), 255)), 0.035)
    return base


def polaroid(photo, title, hand_font, seed):
    rng = random.Random(seed)
    pw, ph = 332, 415
    pad, bottom = 18, 96
    card = Image.new("RGBA", (pw + 2 * pad, ph + pad + bottom), CARD + (255,))
    card.paste(cover(photo, (pw, ph)), (pad, pad))
    d = ImageDraw.Draw(card)
    d.rectangle((pad, pad, pad + pw - 1, pad + ph - 1), outline=(0, 0, 0, 18))
    font = fit(d, title, hand_font, pw - 10, 40, 24)
    lines = wrap(d, title, font, pw - 10)
    if len(lines) > 1:
        font = ImageFont.truetype(hand_font, max(24, font.size - 6))
        lines = wrap(d, title, font, pw - 10)
    line_h = font.size * 1.18
    y = pad + ph + (bottom - line_h * len(lines)) / 2 - 4
    for line in lines:
        d.text((card.width / 2, y), line, font=font, fill=PEN + (255,), anchor="mt")
        y += line_h
    # Tape across the top edge.
    tape = Image.new("RGBA", (150, 40), (226, 214, 192, 205))
    tape = tape.rotate(rng.uniform(-4, 4), expand=True, resample=Image.BICUBIC)
    holder = Image.new("RGBA", (card.width, card.height + 30), (0, 0, 0, 0))
    holder.paste(card, (0, 30))
    holder.alpha_composite(tape, ((holder.width - tape.width) // 2, 8))
    return holder.rotate(rng.uniform(-4.5, -2.5), expand=True, resample=Image.BICUBIC)


def compose(product, photo, fonts):
    seed = product["handle"]
    base = paper(seed).convert("RGBA")
    card = polaroid(photo, product["title"], fonts["hand"], seed)
    # Shadow under the polaroid.
    alpha = card.split()[3]
    shadow = Image.new("RGBA", card.size, (40, 28, 18, 0))
    shadow.putalpha(alpha.point(lambda a: int(a * 0.32)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    cx, cy = W // 2, H // 2 + 6
    x, y = cx - card.width // 2, cy - card.height // 2
    base.alpha_composite(shadow, (x + 6, y + 16))
    base.alpha_composite(card, (x, y))

    d = ImageDraw.Draw(base)
    # Left: the mark. Right: the price. Both clear of a square centre crop.
    serif = ImageFont.truetype(fonts["serif"], 92)
    d.text((72, 250), "JVLI", font=serif, fill=INK, anchor="ls")
    caps = ImageFont.truetype(fonts["caps"], 17)
    for i, line in enumerate(("MADE IN", "TAMIL NADU")):
        d.text((76, 292 + i * 28), " ".join(line), font=caps, fill=MAROON, anchor="ls")
    price = price_text(product)
    if price:
        rupee_font = fonts.get("rupee") or fonts["serif"]
        pf = ImageFont.truetype(fonts["serif"], 58)
        # The rupee sign a touch smaller than the digits, as in print.
        if price.startswith("From "):
            d.text((1128, 222), " ".join("FROM"), font=caps, fill=MAROON, anchor="rs")
            price = price[5:]
        number = price[1:]
        nw = d.textlength(number, font=pf)
        rf = ImageFont.truetype(rupee_font, 50)
        rw = d.textlength("₹", font=rf)
        d.text((1128 - nw - rw - 4, 280), "₹", font=rf, fill=INK, anchor="ls")
        d.text((1128, 280), number, font=pf, fill=INK, anchor="rs")
    if not product.get("variants") or not any(v.get("available") for v in product["variants"]):
        d.text((1128, 320), " ".join("SOLD OUT"), font=caps, fill=MAROON, anchor="rs")
    return base.convert("RGB")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--store", required=True)
    parser.add_argument("--theme", default=".")
    parser.add_argument("--serif", required=True)
    parser.add_argument("--hand", required=True)
    parser.add_argument("--caps", required=True)
    parser.add_argument("--rupee", default="")
    args = parser.parse_args()
    fonts = {"serif": args.serif, "hand": args.hand, "caps": args.caps, "rupee": args.rupee or None}

    assets = os.path.join(args.theme, "assets")
    made, changed = [], 0
    for product in products(args.store.rstrip("/")):
        images = product.get("images") or []
        if not images or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", product["handle"]):
            continue
        src = images[0]["src"]
        src += ("&" if "?" in src else "?") + "width=900"
        photo = Image.open(io.BytesIO(fetch(src))).convert("RGB")
        out = io.BytesIO()
        compose(product, photo, fonts).save(out, "JPEG", quality=84, optimize=True, progressive=True)
        path = os.path.join(assets, f"jvli-og-{product['handle']}.jpg")
        data = out.getvalue()
        if not os.path.exists(path) or open(path, "rb").read() != data:
            with open(path, "wb") as f:
                f.write(data)
            changed += 1
        made.append(product["handle"])

    for name in os.listdir(assets):
        m = re.fullmatch(r"jvli-og-(.+)\.jpg", name)
        if m and m.group(1) not in made:
            os.remove(os.path.join(assets, name))
            changed += 1

    listing = (
        "{%- comment -%} Generated by .github/workflows/og-images.yml: products that have a "
        "polaroid link preview (assets/jvli-og-<handle>.jpg). {%- endcomment -%}"
        + "," + ",".join(sorted(made)) + ",\n"
    )
    snippet = os.path.join(args.theme, "snippets", "jvli-og-handles.liquid")
    if not os.path.exists(snippet) or open(snippet).read() != listing:
        with open(snippet, "w") as f:
            f.write(listing)
        changed += 1
    print(f"{len(made)} products, {changed} files changed")


if __name__ == "__main__":
    main()
