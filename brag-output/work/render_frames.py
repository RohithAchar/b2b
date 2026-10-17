"""Render brag promo frames with Pillow. 1920x1080, 30fps, 20s."""
from PIL import Image, ImageDraw, ImageFont
import os

W, H, FPS, DUR = 1920, 1080, 30, 20
N = FPS * DUR
OUT = "/home/rohith/Documents/b2b/brag-output/work/frames"
os.makedirs(OUT, exist_ok=True)

NAVY = (10, 29, 60)
ORANGE = (255, 106, 0)
BG = (247, 248, 250)
TEXT = (27, 32, 38)
MUTED = (107, 112, 118)
WHITE = (255, 255, 255)
BORDER = (217, 222, 227)
GREEN = (35, 120, 4)

FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

def font(size, bold=True):
    return ImageFont.truetype(FB if bold else FR, size)

def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))

def ease(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3

def text_center(d, y, s, f, fill):
    bbox = d.textbbox((0, 0), s, font=f)
    w = bbox[2] - bbox[0]
    d.text(((W - w) / 2, y), s, font=f, fill=fill)

def pill(d, xy, label, active=False):
    x, y, w, h = xy
    fill = ORANGE if active else WHITE
    fg = WHITE if active else TEXT
    d.rounded_rectangle([x, y, x + w, y + h], radius=12, fill=fill, outline=BORDER, width=2)
    f = font(28, bold=False)
    bb = d.textbbox((0, 0), label, font=f)
    d.text((x + (w - (bb[2]-bb[0]))/2, y + (h - (bb[3]-bb[1]))/2 - 2), label, font=f, fill=fg)

def card(d, x, y, w, h, title, price, unit, moq, supplier, negotiable=False, alpha=1.0):
    # card base
    d.rounded_rectangle([x, y, x+w, y+h], radius=18, fill=WHITE, outline=BORDER, width=3)
    # image block
    d.rounded_rectangle([x, y, x+w, y+220], radius=18, fill=(239, 242, 245))
    f = font(30, bold=False)
    d.text((x+30, y+90), "◈ product photo", font=f, fill=MUTED)
    if negotiable:
        d.rounded_rectangle([x+24, y+24, x+200, y+68], radius=8, fill=ORANGE)
        d.text((x+44, y+30), "Negotiable", font=font(24), fill=WHITE)
    d.text((x+30, y+245), title, font=font(34), fill=TEXT)
    d.text((x+30, y+295), price, font=font(52), fill=TEXT)
    d.text((x+30+ d.textlength(price, font=font(52)) + 12, y+312), f"/ {unit}", font=font(26, False), fill=MUTED)
    d.text((x+30, y+365), f"MOQ: {moq}", font=font(28, False), fill=MUTED)
    # footer
    d.line([x, y+h-80, x+w, y+h-80], fill=BORDER, width=3)
    d.text((x+30, y+h-58), f"✓ {supplier}", font=font(26, False), fill=GREEN)

def scene1(t):
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)
    a1 = ease((t - 0.3) / 0.5)
    a2 = ease((t - 0.9) / 0.5)
    a3 = ease((t - 1.6) / 0.4)
    if a1 > 0:
        f = font(64, False)
        bb = d.textbbox((0,0), "Wholesale,", font=f)
        d.text(((W-(bb[2]-bb[0]))/2, 360 - int(20*(1-a1))), "Wholesale,", font=f, fill=(255,255,255))
    if a2 > 0:
        f = font(110)
        bb = d.textbbox((0,0), "without the chaos.", font=f)
        d.text(((W-(bb[2]-bb[0]))/2, 460 - int(24*(1-a2))), "without the chaos.", font=f, fill=WHITE)
    if a3 > 0:
        bw = int(560 * a3)
        d.rectangle([ (W-bw)/2, 640, (W+bw)/2, 652], fill=ORANGE)
    return img

def scene2(t):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    text_center(d, 150, "Search the wholesale catalog", font(72), TEXT)
    # search bar
    bx, by, bw, bh = 360, 300, 1200, 110
    d.rounded_rectangle([bx, by, bx+bw, by+bh], radius=16, fill=WHITE, outline=BORDER, width=3)
    d.text((bx+36, by+30), "Search cotton fabric…", font=font(40, False), fill=MUTED)
    d.rounded_rectangle([bx+bw-260, by+14, bx+bw-14, by+bh-14], radius=12, fill=ORANGE)
    d.text((bx+bw-200, by+36), "Search", font=font(38), fill=WHITE)
    labels = ["cotton fabric", "led lights", "jute bags", "steel bottles", "spices"]
    x = 360
    for i, lab in enumerate(labels):
        st = 1.0 + i * 0.55
        a = ease((t - st) / 0.35)
        if a <= 0: continue
        dy = int(24 * (1 - a))
        w = int(d.textlength(lab, font=font(28, False)) + 56)
        pill(d, (x, 470 + dy, w, 64), lab, active=(i == 0))
        x += w + 24
    d.text((360, 580), "Live categories • real suppliers • India-wide sourcing", font=font(32, False), fill=MUTED)
    return img

PRODUCTS = [
    ("Cotton Fabric", "₹185", "metre", "500 metres", "Shree Textiles • Surat", False),
    ("LED Panel Lights", "₹240", "piece", "100 pieces", "BrightLine • Mumbai", True),
    ("Jute Bags", "₹42", "piece", "1000 pieces", "EcoPack • Kolkata", False),
]

def scene3(t):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    text_center(d, 90, "Price. MOQ. Verified supplier. Up front.", font(56), TEXT)
    starts = [0.7, 2.9, 5.1]
    for i, (title, price, unit, moq, sup, neg) in enumerate(PRODUCTS):
        a = ease((t - starts[i]) / 0.45)
        if a <= 0: continue
        x = 150 + i * 560
        y = 220 + int(40 * (1 - a))
        card(d, x, y, 500, 640, title, price, unit, moq, sup, neg)
    return img

def scene4(t):
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)
    lines = ["Price. MOQ.", "Verified supplier."]
    for i, ln in enumerate(lines):
        a = ease((t - 0.3 - i*0.5) / 0.5)
        if a > 0:
            f = font(88)
            bb = d.textbbox((0,0), ln, font=f)
            d.text(((W-(bb[2]-bb[0]))/2, 340 + i*130 - int(20*(1-a))), ln, font=f, fill=WHITE)
    a = ease((t - 1.5) / 0.5)
    if a > 0:
        f = font(96)
        bb = d.textbbox((0,0), "Up front.", font=f)
        d.text(((W-(bb[2]-bb[0]))/2, 610), "Up front.", font=f, fill=ORANGE)
        bw = int(420 * a)
        d.rectangle([(W-bw)/2, 740, (W+bw)/2, 750], fill=ORANGE)
    f2 = font(30, False)
    bb = d.textbbox((0,0), "B2B  MARKETPLACE", font=f2)
    d.text(((W-(bb[2]-bb[0]))/2, 830), "B2B  MARKETPLACE", font=f2, fill=(255,255,255))
    return img

SCENES = [(0.0, 3.0, scene1), (3.0, 8.0, scene2), (8.0, 16.0, scene3), (16.0, 20.0, scene4)]
XF = 0.5

def render_at(gt):
    # find scene
    for i, (s, e, fn) in enumerate(SCENES):
        if s <= gt < e or (i == len(SCENES)-1 and gt >= e):
            lt = min(max(gt - s, 0), e - s)
            base = fn(lt)
            # crossfade from prev
            if gt - s < XF and i > 0:
                ps, pe, pfn = SCENES[i-1]
                prev = pfn(pe - ps)
                alpha = (gt - s) / XF
                base = Image.blend(prev, base, clamp(alpha))
            return base
    return SCENES[-1][2](4.0)

for f in range(N):
    gt = f / FPS
    img = render_at(gt)
    img.save(f"{OUT}/f{f:04d}.png")
    if f % 60 == 0:
        print(f"frame {f}/{N}", flush=True)
print("done", N)
