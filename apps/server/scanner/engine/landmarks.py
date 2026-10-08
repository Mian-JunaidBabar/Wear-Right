"""MediaPipe Face Landmarker wrapper. The model file is loaded once and reused. No Django imports."""
import threading

import cv2
import numpy as np


class FaceDetector:
    """Finds one face and returns its 478 landmarks in pixel coordinates."""

    def __init__(self, model_path):
        # Imported here so the rest of the engine (and its tests) work without MediaPipe loaded.
        import mediapipe as mp
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision

        self._mp = mp
        options = vision.FaceLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=str(model_path)), num_faces=1,
        )
        self._landmarker = vision.FaceLandmarker.create_from_options(options)
        self._lock = threading.Lock()  # a landmarker instance is not safe to share between threads

    def detect(self, bgr):
        """(478, 2) float array of landmark pixels, or None when no face is found."""
        height, width = bgr.shape[:2]
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        image = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
        with self._lock:
            result = self._landmarker.detect(image)
        if not result.face_landmarks:
            return None
        return np.array([(p.x * width, p.y * height) for p in result.face_landmarks[0]], dtype=np.float32)

    def close(self):
        self._landmarker.close()
