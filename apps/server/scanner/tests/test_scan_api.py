import os

import pytest
from rest_framework.test import APIClient

from accounts.models import UserProfile
from scanner.engine.skin import MONK_SWATCHES
from scanner.models import FaceScanRecord
from scanner.tests.fakes import encode_jpeg, synthetic_face

pytestmark = pytest.mark.django_db


def _bgr(hex_value):
    return tuple(int(hex_value[i:i + 2], 16) for i in (5, 3, 1))


@pytest.fixture
def fair_face(monkeypatch):
    """A synthetic Monk-5 face, with the detector the scanner will use."""
    image, detector = synthetic_face(_bgr(MONK_SWATCHES[4]))
    monkeypatch.setattr("scanner.services.get_detector", lambda: detector)
    return image


def _post(client, image, frames=3):
    files = [encode_jpeg(image) for _ in range(frames)]
    return client.post("/api/scanner/analyze/", {"images": files}, format="multipart")


def test_a_guest_gets_a_full_reading_and_nothing_is_stored(api_client, fair_face):
    response = _post(api_client, fair_face)

    body = response.json()
    assert response.status_code == 200 and body["status"] == "success"
    assert body["detected_skin_tone"] == "Fair"
    assert body["monk"] == 5 and body["undertone"] == "warm"
    assert {"ita", "hue", "agreement", "confidence_score", "lighting_quality", "brightness", "message",
            "total_frames_analyzed", "all_frame_results", "selected_frame_debug"} <= set(body)
    assert body["total_frames_analyzed"] == 3 and body["agreement"] == 1.0
    assert "Monk 5" in body["message"]
    assert FaceScanRecord.objects.count() == 0


def test_a_signed_in_scan_is_saved_on_the_record_and_the_profile(user, fair_face):
    client = APIClient()
    client.force_authenticate(user=user)

    _post(client, fair_face)

    record = FaceScanRecord.objects.get()
    assert record.user == user
    assert (record.detected_skin_tone, record.monk, record.undertone) == ("Fair", 5, "warm")
    assert record.ita is not None and record.hue is not None
    profile = UserProfile.objects.get(user=user)
    assert (profile.skin_tone, profile.monk_tone, profile.undertone) == ("Fair", 5, "warm")


def test_the_photo_itself_is_never_stored(user, fair_face, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    client = APIClient()
    client.force_authenticate(user=user)

    _post(client, fair_face)

    assert not [name for _, _, names in os.walk(tmp_path) for name in names]
    assert not any(field.name in {"image", "photo", "frame"} for field in FaceScanRecord._meta.get_fields())


def test_an_unusable_scan_asks_for_a_rescan_and_leaves_the_profile_alone(user, monkeypatch):
    image, detector = synthetic_face((8, 8, 8), background_bgr=(5, 5, 5), bright_eyes=False)
    monkeypatch.setattr("scanner.services.get_detector", lambda: detector)
    UserProfile.objects.create(user=user, skin_tone="Dark", monk_tone=8, undertone="cool")
    client = APIClient()
    client.force_authenticate(user=user)

    body = _post(client, image).json()

    assert body["status"] == "failed" and body["detected_skin_tone"] == "Rescan Required"
    assert body["reason"] == "too_dark" and "light" in body["message"].lower()
    assert FaceScanRecord.objects.get().detected_skin_tone == "Rescan Required"
    profile = UserProfile.objects.get(user=user)
    assert (profile.skin_tone, profile.monk_tone) == ("Dark", 8)  # the earlier good scan survives


def test_a_frame_without_a_face_says_so(api_client):
    image, _ = synthetic_face((140, 172, 224))  # the default test detector finds no face

    body = _post(api_client, image, frames=1).json()

    assert body["status"] == "failed" and body["reason"] == "no_face"


def test_one_bad_frame_among_good_ones_does_not_fail_the_scan(api_client, monkeypatch):
    good, detector = synthetic_face(_bgr(MONK_SWATCHES[4]))
    dark, _ = synthetic_face((8, 8, 8), background_bgr=(5, 5, 5), bright_eyes=False)
    monkeypatch.setattr("scanner.services.get_detector", lambda: detector)

    files = [encode_jpeg(good), encode_jpeg(dark), encode_jpeg(good)]
    body = api_client.post("/api/scanner/analyze/", {"images": files}, format="multipart").json()

    assert body["status"] == "success" and body["monk"] == 5
    assert body["selected_frame_debug"]["frames_used"] == 2


def test_a_missing_model_file_is_a_clear_503(api_client, monkeypatch, settings, tmp_path):
    import scanner.services as services
    monkeypatch.undo()  # drop the autouse stand-in so the real get_detector runs
    monkeypatch.setattr(services, "_detector", None)
    settings.ML_MODELS_DIR = tmp_path  # no face_landmarker.task in here
    image, _ = synthetic_face((140, 172, 224))

    response = _post(api_client, image, frames=1)

    assert response.status_code == 503
    assert "make models" in response.json()["message"]


def test_the_profile_accepts_a_user_chosen_undertone_and_rejects_bad_values(user):
    client = APIClient()
    client.force_authenticate(user=user)
    UserProfile.objects.create(user=user)

    assert client.patch("/api/auth/me/", {"undertone": "cool", "monk_tone": 6}, format="json").status_code == 200
    assert UserProfile.objects.get(user=user).undertone == "cool"
    assert client.patch("/api/auth/me/", {"undertone": "purple"}, format="json").status_code == 400
    assert client.patch("/api/auth/me/", {"monk_tone": 11}, format="json").status_code == 400
