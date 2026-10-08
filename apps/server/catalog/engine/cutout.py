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
