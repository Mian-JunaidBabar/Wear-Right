"""Background removal for product photos, using rembg.

Nothing here loads a model at import time. rembg downloads the model the first time a
session is created, so callers create one remover per run and reuse it.
"""
from collections.abc import Callable

from PIL import Image

DEFAULT_MODEL = "isnet-general-use"

Remover = Callable[[Image.Image], Image.Image]


def cut_out(image, remover):
    """Return the image with its background transparent, as RGBA."""
    return remover(image.convert("RGB")).convert("RGBA")


def rembg_remover(model_name=DEFAULT_MODEL, model_dir=None):
    """Build a remover backed by rembg. Weights are read from model_dir (downloaded there if missing)."""
    import os

    if model_dir is not None:
        os.environ["U2NET_HOME"] = str(model_dir)  # rembg reads this when the session is created
    from rembg import new_session, remove

    session = new_session(model_name)
    return lambda image: remove(image, session=session)


CLOTH_MODEL = "u2net_cloth_seg"


def cloth_remover(model_dir=None):
    """Build the cloth segmentation function (rembg `u2net_cloth_seg`): photo in, three stacked cut-outs out."""
    return rembg_remover(CLOTH_MODEL, model_dir)


def cloth_segmenter(model_dir=None):
    """Upper/lower body clothes masks (rembg `u2net_cloth_seg`) for the alpha mannequin.

    Returns a function: RGB array or PIL image in, (upper, lower, full) boolean arrays of the same size out.
    rembg's cloth session `predict` gives three greyscale masks: upper body, lower body, full body.
    """
    import os

    from PIL import Image as PILImage

    if model_dir is not None:
        os.environ["U2NET_HOME"] = str(model_dir)
    from rembg import new_session

    session = new_session(CLOTH_MODEL)

    def segment(image):
        if not hasattr(image, "convert"):
            image = PILImage.fromarray(image)
        masks = session.predict(image.convert("RGB"))
        return cloth_masks_from_predict(masks)

    return segment


def cloth_masks_from_predict(masks):
    """(upper, lower, full) boolean arrays from rembg's cloth `predict` output (a list of greyscale masks).

    The full-body mask matters for kurtas and kameez: the model labels a long shirt as "full", not "upper".
    """
    import numpy as np

    if len(masks) < 3:
        raise ValueError(f"cloth segmentation returned {len(masks)} masks, expected 3 (upper, lower, full)")
    return tuple(np.asarray(mask.convert("L")) > 127 for mask in masks[:3])
