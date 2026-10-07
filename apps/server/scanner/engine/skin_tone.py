import cv2
import numpy as np


def _resize_image(img, width=700):
    height = int((width / img.shape[1]) * img.shape[0])
    return cv2.resize(img, (width, height))


def _gray_world_white_balance(img):
    img_float = img.astype(np.float32)

    b_avg = np.mean(img_float[:, :, 0])
    g_avg = np.mean(img_float[:, :, 1])
    r_avg = np.mean(img_float[:, :, 2])

    gray_avg = (b_avg + g_avg + r_avg) / 3.0

    img_float[:, :, 0] *= gray_avg / (b_avg + 1e-6)
    img_float[:, :, 1] *= gray_avg / (g_avg + 1e-6)
    img_float[:, :, 2] *= gray_avg / (r_avg + 1e-6)

    return np.clip(img_float, 0, 255).astype(np.uint8)


def _gamma_correction(img, gamma=1.25):
    inv_gamma = 1.0 / gamma
    table = np.array([
        ((i / 255.0) ** inv_gamma) * 255 for i in range(256)
    ]).astype("uint8")

    return cv2.LUT(img, table)


def _clahe_lighting_correction(img):
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    corrected_l = clahe.apply(l_channel)

    corrected_lab = cv2.merge((corrected_l, a_channel, b_channel))
    return cv2.cvtColor(corrected_lab, cv2.COLOR_LAB2BGR)


def _detect_face_or_center_crop(img):
    try:
        if hasattr(cv2, "CascadeClassifier") and hasattr(cv2, "data"):
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            face_cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            face_cascade = cv2.CascadeClassifier(face_cascade_path)

            faces = face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(120, 120)
            )

            if len(faces) > 0:
                x, y, w, h = max(faces, key=lambda item: item[2] * item[3])

                x1 = max(x + int(w * 0.18), 0)
                y1 = max(y + int(h * 0.22), 0)
                x2 = min(x + int(w * 0.82), img.shape[1])
                y2 = min(y + int(h * 0.78), img.shape[0])

                return img[y1:y2, x1:x2], True
    except Exception:
        pass

    h, w = img.shape[:2]

    x1 = int(w * 0.28)
    x2 = int(w * 0.72)
    y1 = int(h * 0.18)
    y2 = int(h * 0.68)

    return img[y1:y2, x1:x2], False


def _detect_lighting_quality(face_img):
    gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)

    avg_brightness = float(np.mean(gray))
    std_contrast = float(np.std(gray))
    dark_ratio = float(np.sum(gray < 85) / gray.size)
    bright_ratio = float(np.sum(gray > 220) / gray.size)

    if avg_brightness < 55 or dark_ratio > 0.65:
        quality = "Too Low"
    elif avg_brightness < 125 or dark_ratio > 0.35:
        quality = "Low"
    elif avg_brightness > 220 or bright_ratio > 0.45:
        quality = "Too Bright"
    elif avg_brightness < 170:
        quality = "Normal"
    else:
        quality = "Good"

    return quality, avg_brightness, std_contrast, dark_ratio, bright_ratio


def _extract_skin_pixels(face_img):
    hsv = cv2.cvtColor(face_img, cv2.COLOR_BGR2HSV)
    ycrcb = cv2.cvtColor(face_img, cv2.COLOR_BGR2YCrCb)

    lower_hsv = np.array([0, 12, 35], dtype=np.uint8)
    upper_hsv = np.array([35, 200, 255], dtype=np.uint8)
    hsv_mask = cv2.inRange(hsv, lower_hsv, upper_hsv)

    lower_ycrcb = np.array([0, 128, 68], dtype=np.uint8)
    upper_ycrcb = np.array([255, 185, 145], dtype=np.uint8)
    ycrcb_mask = cv2.inRange(ycrcb, lower_ycrcb, upper_ycrcb)

    skin_mask = cv2.bitwise_and(hsv_mask, ycrcb_mask)

    kernel = np.ones((5, 5), np.uint8)
    skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_OPEN, kernel)
    skin_mask = cv2.morphologyEx(skin_mask, cv2.MORPH_CLOSE, kernel)

    return face_img[skin_mask > 0]


def _classify_by_ita(avg_l, avg_b):
    """
    ITA = Individual Typology Angle.
    It uses CIELAB L* and b* values for skin tone classification.
    """

    if avg_b == 0:
        avg_b = 1e-6

    ita = np.degrees(np.arctan((avg_l - 50) / avg_b))

    if ita > 41:
        tone = "Fair"
    elif ita >= 10:
        tone = "Medium"
    else:
        tone = "Dark"

    return tone, float(ita)


def classify_skin_tone(image_buffer):
    np_arr = np.frombuffer(image_buffer.read(), np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if img is None:
        return {
            "tone": "Unknown",
            "confidence": 0,
            "lighting_quality": "Unknown",
            "brightness": 0,
            "message": "Image could not be processed."
        }

    img = _resize_image(img)

    face_img, face_found = _detect_face_or_center_crop(img)

    lighting_quality, brightness, contrast, dark_ratio, bright_ratio = _detect_lighting_quality(face_img)

    if lighting_quality == "Too Low":
        return {
            "tone": "Rescan Required",
            "confidence": 0,
            "lighting_quality": lighting_quality,
            "brightness": round(brightness, 2),
            "message": "Lighting is too low. Original skin tone cannot be detected accurately. Please scan again in brighter light.",
            "debug": {
                "face_found": face_found,
                "dark_ratio": round(dark_ratio, 2),
                "bright_ratio": round(bright_ratio, 2)
            }
        }

    if lighting_quality == "Too Bright":
        return {
            "tone": "Rescan Required",
            "confidence": 0,
            "lighting_quality": lighting_quality,
            "brightness": round(brightness, 2),
            "message": "Lighting is too bright or face is overexposed. Please scan again in normal light.",
            "debug": {
                "face_found": face_found,
                "dark_ratio": round(dark_ratio, 2),
                "bright_ratio": round(bright_ratio, 2)
            }
        }

    corrected = _gray_world_white_balance(face_img)

    if lighting_quality == "Low":
        corrected = _gamma_correction(corrected, gamma=1.45)
    elif lighting_quality == "Normal":
        corrected = _gamma_correction(corrected, gamma=1.20)

    corrected = _clahe_lighting_correction(corrected)

    skin_pixels = _extract_skin_pixels(corrected)

    if len(skin_pixels) < 400:
        return {
            "tone": "Rescan Required",
            "confidence": 0,
            "lighting_quality": lighting_quality,
            "brightness": round(brightness, 2),
            "message": "Skin area was not detected clearly. Please face the camera and scan again."
        }

    skin_pixels_reshaped = skin_pixels.reshape(-1, 1, 3)
    lab_pixels = cv2.cvtColor(skin_pixels_reshaped, cv2.COLOR_BGR2LAB)

    avg_l_opencv = float(np.mean(lab_pixels[:, :, 0]))
    avg_b_opencv = float(np.mean(lab_pixels[:, :, 2]))

    # OpenCV LAB values are 0-255.
    # Convert L* approximately to 0-100 scale.
    avg_l_star = (avg_l_opencv / 255.0) * 100.0

    # OpenCV b channel is shifted by +128.
    avg_b_star = avg_b_opencv - 128.0

    # Avoid negative/very small b* causing unstable ITA.
    avg_b_for_ita = max(avg_b_star, 1.0)

    tone, ita = _classify_by_ita(avg_l_star, avg_b_for_ita)

    confidence = 92

    if not face_found:
        confidence -= 10

    if lighting_quality == "Low":
        confidence -= 18
    elif lighting_quality == "Normal":
        confidence -= 7

    if len(skin_pixels) < 1500:
        confidence -= 8

    confidence = max(45, min(confidence, 96))

    if lighting_quality == "Low":
        message = "Low but usable lighting detected. Image was normalized before ITA-based classification."
    elif lighting_quality == "Normal":
        message = "Normal lighting detected. ITA-based skin tone classification completed."
    else:
        message = "Good lighting detected. ITA-based skin tone classification completed."

    return {
        "tone": tone,
        "confidence": round(confidence, 1),
        "lighting_quality": lighting_quality,
        "brightness": round(brightness, 2),
        "message": message,
        "debug": {
            "face_found": face_found,
            "avg_l_star": round(avg_l_star, 2),
            "avg_b_star": round(avg_b_star, 2),
            "ita": round(ita, 2),
            "dark_ratio": round(dark_ratio, 2),
            "bright_ratio": round(bright_ratio, 2),
            "skin_pixels": int(len(skin_pixels))
        }
    }