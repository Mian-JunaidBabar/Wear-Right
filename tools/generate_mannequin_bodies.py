"""Draws the 12 neutral mannequin bodies (2 genders x 3 sizes x front/back) and their anchor map.

Output (apps/web/public/mannequin/): <gender>-<size>-<angle>.png at 800 x 1600 on a transparent
background, and anchors.json with the box (x, y, width, height in canvas pixels) where each garment
slot is placed. The boxes come from the same geometry as the drawings, so they cannot drift apart.

These are procedural placeholders, not MPFB renders (the PRD's plan; Blender is not available here).
Real renders can replace the PNGs: keep the 800 x 1600 canvas and edit anchors.json to match.

Run from the repo root:  apps/server/venv/bin/python tools/generate_mannequin_bodies.py
"""
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

W, H, SCALE = 800, 1600, 2          # canvas, and supersampling for smooth edges
CX = W // 2
OUT = Path(__file__).resolve().parent.parent / "apps" / "web" / "public" / "mannequin"
GENDERS = ("men", "women")
SIZES = {"slim": 0.88, "regular": 1.0, "plus": 1.28}   # width factor
WAIST_INCHES = {"slim": "30-32", "regular": "34-38", "plus": "40+"}
BODY = (196, 198, 204)
SHADE = (150, 152, 160)

# Widths in pixels at the regular size: shoulders, waist, hips.
SHAPE = {"men": dict(shoulder=300, waist=232, hip=250), "women": dict(shoulder=252, waist=196, hip=284)}
HEAD_TOP, HEAD_H, NECK_Y, SHOULDER_Y, WAIST_Y, HIP_Y, CROTCH_Y, KNEE_Y, ANKLE_Y, FOOT_Y = 40, 150, 190, 262, 640, 790, 850, 1180, 1450, 1545
ARM_W = 56


def geometry(gender, size):
    f = SIZES[size]
    s = SHAPE[gender]
    shoulder, waist, hip = s["shoulder"] * f, s["waist"] * f, s["hip"] * f
    arm_w = ARM_W * (0.9 + 0.1 * f) * (f ** 0.5)
    return dict(shoulder=shoulder, waist=waist, hip=hip, arm_w=arm_w, leg_w=(hip / 2) * 0.86, f=f)


def torso_polygon(g):
    c = CX
    return [
        (c - g["shoulder"] / 2, SHOULDER_Y), (c + g["shoulder"] / 2, SHOULDER_Y),
        (c + g["waist"] / 2, WAIST_Y), (c + g["hip"] / 2, HIP_Y), (c + g["hip"] / 2, CROTCH_Y),
        (c - g["hip"] / 2, CROTCH_Y), (c - g["hip"] / 2, HIP_Y), (c - g["waist"] / 2, WAIST_Y),
    ]


def draw_body(gender, size, angle):
    g = geometry(gender, size)
    big = (W * SCALE, H * SCALE)
    mask = Image.new("L", big, 0)
    d = ImageDraw.Draw(mask)

    def poly(points):
        d.polygon([(x * SCALE, y * SCALE) for x, y in points], fill=255)

    def ellipse(cx, cy, rx, ry):
        d.ellipse([(cx - rx) * SCALE, (cy - ry) * SCALE, (cx + rx) * SCALE, (cy + ry) * SCALE], fill=255)

    def limb(x_top, y_top, x_bottom, y_bottom, w_top, w_bottom):
        poly([(x_top - w_top / 2, y_top), (x_top + w_top / 2, y_top), (x_bottom + w_bottom / 2, y_bottom), (x_bottom - w_bottom / 2, y_bottom)])

    head_rx = 56 if gender == "men" else 52
    ellipse(CX, HEAD_TOP + HEAD_H / 2, head_rx, HEAD_H / 2)
    limb(CX, NECK_Y - 10, CX, SHOULDER_Y + 14, 54 * g["f"] ** 0.4, 76 * g["f"] ** 0.4)       # neck
    poly(torso_polygon(g))
    for side in (-1, 1):
        shoulder_x = CX + side * g["shoulder"] / 2
        ellipse(shoulder_x, SHOULDER_Y + 18, g["arm_w"] / 2 + 6, 34)                           # shoulder cap
        limb(shoulder_x + side * 8, SHOULDER_Y + 20, shoulder_x + side * 30, 790, g["arm_w"], g["arm_w"] * 0.74)  # arm
        ellipse(shoulder_x + side * 32, 828, g["arm_w"] * 0.42, 44)                           # hand
        leg_x = CX + side * g["hip"] * 0.26
        limb(leg_x, CROTCH_Y - 30, leg_x + side * 4, KNEE_Y, g["leg_w"], g["leg_w"] * 0.74)    # thigh
        limb(leg_x + side * 4, KNEE_Y - 10, leg_x + side * 6, ANKLE_Y, g["leg_w"] * 0.74, g["leg_w"] * 0.5)  # shin
        foot_w = 92 * (0.9 + 0.1 * g["f"])
        ellipse(leg_x + side * 10 + side * foot_w * 0.08, FOOT_Y - 36, foot_w / 2, 52)         # foot

    mask = mask.filter(ImageFilter.GaussianBlur(1.2 * SCALE / 2))
    # Volume: darken towards the silhouette edge, and a touch lighter in the middle.
    edge = mask.filter(ImageFilter.GaussianBlur(26 * SCALE / 2))
    shade = ImageChops.invert(edge)
    body = Image.new("RGB", big, BODY)
    body = Image.composite(Image.new("RGB", big, SHADE), body, shade.point(lambda v: int(v * 0.55)))
    if angle == "back":
        body = Image.composite(Image.new("RGB", big, (172, 174, 182)), body, Image.new("L", big, 70))
    out = Image.new("RGBA", big, (0, 0, 0, 0))
    out.paste(body, (0, 0), mask)
    return out.resize((W, H), Image.LANCZOS), g


def anchors_for(gender, size):
    """Slot boxes (x, y, width, height) in canvas pixels for one body."""
    g = geometry(gender, size)
    span = g["shoulder"] + 2 * g["arm_w"] + 30          # shoulder to shoulder including the hanging arms
    def box(width, y0, y1):
        return [round(CX - width / 2), y0, round(width), y1 - y0]
    return {
        "top": box(span, SHOULDER_Y - 14, HIP_Y + 40),
        "outerwear": box(span + 36, SHOULDER_Y - 20, HIP_Y + 110),
        "kurta": box(span + 20, SHOULDER_Y - 14, KNEE_Y - 30),
        "dupatta": box(span * 0.92, SHOULDER_Y - 10, HIP_Y + 260),
        "bottom": box(g["hip"] + 60, WAIST_Y - 20, ANKLE_Y + 30),
        "footwear": box(g["hip"] * 0.9 + 70, ANKLE_Y + 20, FOOT_Y + 40),
        "belt": box(g["waist"] + 30, WAIST_Y - 24, WAIST_Y + 34),
        "watch": [round(CX + g["shoulder"] / 2 + 12 + g["arm_w"] * 0.1), 740, 64, 64],
        "tie": box(86, SHOULDER_Y - 6, HIP_Y - 120),
        "cap": box(150, HEAD_TOP - 18, HEAD_TOP + 76),
        "sunglasses": box(128, HEAD_TOP + 62, HEAD_TOP + 106),
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    bodies = {}
    for gender in GENDERS:
        for size in SIZES:
            anchors = anchors_for(gender, size)
            for angle in ("front", "back"):
                image, _ = draw_body(gender, size, angle)
                name = f"{gender}-{size}-{angle}.png"
                image.save(OUT / name, optimize=True)
                bodies[f"{gender}/{size}/{angle}"] = {"image": f"/mannequin/{name}", "slots": anchors}
    config = {
        "version": 1,
        "note": "Procedural placeholder bodies, not MPFB renders. Boxes are [x, y, width, height] on an 800 x 1600 canvas.",
        "canvas": {"width": W, "height": H},
        "sizes": {name: {"waist_inches": WAIST_INCHES[name]} for name in SIZES},
        "z_order": {"bottom": 10, "top": 20, "kurta": 20, "belt": 25, "outerwear": 30, "dupatta": 35, "footwear": 40, "accessory": 50},
        "hidden_in_back": ["tie", "sunglasses"],
        "bodies": bodies,
    }
    (OUT / "anchors.json").write_text(json.dumps(config, indent=1), encoding="utf-8")
    print(f"wrote {len(bodies)} bodies and anchors.json to {OUT}")


if __name__ == "__main__":
    main()
