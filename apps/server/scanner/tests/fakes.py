"""Test doubles for the face detector: a synthetic face whose sampling regions are known rectangles."""
import cv2
import numpy as np

from scanner.engine.regions import FOREHEAD, LEFT_CHEEK, RIGHT_CHEEK

WIDTH, HEIGHT = 400, 500
FACE_BOX = (100, 80, 300, 420)  # x0, y0, x1, y1
_RECTS = {  # region -> (x0, y0, x1, y1)
    "left_cheek": (120, 250, 190, 330),
    "right_cheek": (210, 250, 280, 330),
    "forehead": (150, 90, 250, 140),
}
_INDICES = {"left_cheek": LEFT_CHEEK, "right_cheek": RIGHT_CHEEK, "forehead": FOREHEAD}


class NoFaceDetector:
    def detect(self, bgr):
        return None


class FixedLandmarkDetector:
    """Returns fixed landmarks, scaled the way a real detector's would be if the pipeline resized the frame."""

    def __init__(self, landmarks, reference_width=WIDTH):
        self.landmarks = landmarks
        self.reference_width = reference_width

    def detect(self, bgr):
        return self.landmarks * (bgr.shape[1] / self.reference_width)


def _perimeter(rect, count):
    x0, y0, x1, y1 = rect
    corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    return corners + [corners[-1]] * (count - 4)  # extra points repeat a corner so the polygon is traced once


def synthetic_landmarks():
    """478 landmarks: every region index sits on its rectangle, the rest at the face centre."""
    points = np.full((478, 2), ((FACE_BOX[0] + FACE_BOX[2]) / 2, (FACE_BOX[1] + FACE_BOX[3]) / 2), dtype=np.float32)
    for name, indices in _INDICES.items():
        for index, point in zip(indices, _perimeter(_RECTS[name], len(indices))):
            points[index] = point
    points[234], points[454] = (FACE_BOX[0], 250), (FACE_BOX[2], 250)  # left and right edge of the face
    points[8], points[152] = (200, FACE_BOX[1]), (200, FACE_BOX[3])     # top and bottom of the face
    return points


def synthetic_face(skin_bgr, background_bgr=(120, 120, 120), bright_eyes=True):
    """(image, detector) for a flat skin colour inside the face box. Bright patches stand in for eyes and teeth."""
    image = np.full((HEIGHT, WIDTH, 3), background_bgr, dtype=np.uint8)
    x0, y0, x1, y1 = FACE_BOX
    image[y0:y1, x0:x1] = skin_bgr
    if bright_eyes:
        image[170:190, 130:180] = (235, 235, 235)
        image[170:190, 220:270] = (235, 235, 235)
    return image, FixedLandmarkDetector(synthetic_landmarks())


def encode_jpeg(bgr):
    ok, buffer = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 98])
    assert ok
    import io
    data = io.BytesIO(buffer.tobytes())
    data.name = "frame.jpg"
    return data
