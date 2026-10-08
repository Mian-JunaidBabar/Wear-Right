"""Getting a product photo ready for the 2D mannequin. Pure Python, no Django imports.

A garment can be placed on the mannequin only if the photo shows the garment alone (flat-lay or ghost
mannequin). A photo of a person wearing it would put a second face and body on the mannequin, so those
are flagged instead of being placed.
"""
import cv2
import numpy as np
from PIL import Image

APPAREL_SLOTS = {"top", "bottom", "kurta", "outerwear", "dupatta"}  # only these are checked for skin
# rembg's cloth model returns three stacked cut-outs: 0 upper-body clothes, 1 lower-body clothes, 2 full-body clothes.
GARMENT_LAYERS = {"top": (0,), "outerwear": (0,), "bottom": (1,), "kurta": (0, 2)}
# Layers that stay empty on a flat-lay photo. Not used for outerwear: the cloth model calls part of a flat blazer "lower body".
LEAK_LAYERS = {"top": (1,), "bottom": (0,)}
LEAK_SHARE = 0.03          # more clothing than this in a leak layer: another garment, so a person is wearing it
MIN_GARMENT_SHARE = 0.04   # an extracted garment smaller than this is a failed extraction
FRAGMENT_RATIO = 0.03      # connected pieces smaller than this share of the largest piece are noise

ALPHA_VISIBLE = 128
MAX_SKIN_SHARE = 0.12       # more visible skin than this: a person is in the photo
MIN_CONTENT_SHARE = 0.01    # the garment must cover at least this much of the cut-out canvas
FACE_CHECK_SIZE = 640       # the face detector runs on a copy no larger than this

REASON_FACE = "a person is in the photo"
REASON_SKIN = "skin is visible in the photo"
REASON_EMPTY = "the cut-out has almost no content"
REASON_NO_SPLIT = "the garment could not be separated from the person"
NOTE_EXTRACTED = "garment extracted from a model photo"


def trim_to_content(image, alpha_threshold=16):
    """Crop an RGBA image to the box that holds its visible pixels. An empty image is returned unchanged."""
    rgba = image.convert("RGBA")
    box = rgba.getchannel("A").point(lambda a: 255 if a >= alpha_threshold else 0).getbbox()
    return rgba.crop(box) if box else rgba


def skin_share(image):
    """Share of the visible pixels that look like skin (YCrCb range). Garments in skin-like colours score high too."""
    rgba = np.asarray(image.convert("RGBA"))
    visible = rgba[..., 3] >= ALPHA_VISIBLE
    if not visible.any():
        return 0.0
    bgr = np.ascontiguousarray(rgba[..., :3][..., ::-1])
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    skin = cv2.inRange(ycrcb, np.array([0, 140, 85], np.uint8), np.array([255, 175, 125], np.uint8)) > 0
    return float((skin & visible).sum() / visible.sum())


def content_share(image):
    alpha = np.asarray(image.convert("RGBA"))[..., 3]
    return float((alpha >= ALPHA_VISIBLE).mean())


def face_view(image):
    """BGR copy of the cut-out on a neutral grey background, small enough for fast face detection."""
    rgba = image.convert("RGBA")
    rgba.thumbnail((FACE_CHECK_SIZE, FACE_CHECK_SIZE))
    flat = Image.new("RGB", rgba.size, (128, 128, 128))
    flat.paste(rgba, mask=rgba.getchannel("A"))
    return np.ascontiguousarray(np.asarray(flat)[..., ::-1])


def assess(image, detector=None, slot=""):
    """(ready, note) for a cut-out. `detector` is anything with detect(bgr) -> landmarks or None.

    The skin test only applies to apparel: brown shoes, leather and sunglasses are skin-coloured too.
    """
    if content_share(image) < MIN_CONTENT_SHARE:
        return False, REASON_EMPTY
    if detector is not None and detector.detect(face_view(image)) is not None:
        return False, REASON_FACE
    if (not slot or slot in APPAREL_SLOTS) and skin_share(image) > MAX_SKIN_SHARE:
        return False, REASON_SKIN
    return True, ""


def flatten_on_white(image):
    """RGB copy on a white background. The cloth model mistakes a black background for dark clothing
    (black patches between trouser legs, holes in dark tops), so it is never given a black one."""
    rgba = image.convert("RGBA")
    flat = Image.new("RGB", rgba.size, (255, 255, 255))
    flat.paste(rgba, mask=rgba.getchannel("A"))
    return flat


def split_layers(stacked):
    """The three equal-height cut-outs inside the cloth model's stacked output."""
    height = stacked.size[1] // 3
    return [stacked.crop((0, i * height, stacked.size[0], (i + 1) * height)) for i in range(3)]


def clean_cutout(image):
    """Hard edge at alpha 128, then drop disconnected specks so they do not stretch the trim box."""
    rgba = np.array(image.convert("RGBA"))
    alpha = (rgba[..., 3] >= ALPHA_VISIBLE).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(alpha, connectivity=8)
    if count > 1:
        areas = stats[1:, cv2.CC_STAT_AREA]
        keep = [i + 1 for i, area in enumerate(areas) if area >= FRAGMENT_RATIO * areas.max()]
        alpha = np.isin(labels, keep).astype(np.uint8)
    rgba[..., 3] = alpha * 255
    rgba[alpha == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def union_layers(layers):
    """One RGBA image from several cloth layers: a pixel is garment if any layer has it."""
    arrays = [np.array(layer.convert("RGBA")) for layer in layers]
    merged = arrays[0].copy()
    for other in arrays[1:]:
        take = (other[..., 3] > merged[..., 3])
        merged[take] = other[take]
    return Image.fromarray(merged, "RGBA")


def extract_garment(slot, layers):
    """(garment RGBA, share of clothing in the layers that should be empty) from the cloth model's three layers."""
    garment = clean_cutout(union_layers([layers[i] for i in GARMENT_LAYERS[slot]]))
    leak = max((content_share(layers[i]) for i in LEAK_LAYERS.get(slot, ())), default=0.0)
    return garment, leak
