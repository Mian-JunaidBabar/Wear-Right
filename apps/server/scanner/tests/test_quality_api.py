"""The scan API reports the photo quality checks, and rejects a photo taken under a yellow bulb."""
import pytest

from scanner.tests.fakes import encode_jpeg, synthetic_face

pytestmark = pytest.mark.django_db

SKIN = (140, 172, 224)
YELLOW_WALL = (170, 228, 245)
WHITE_WALL = (235, 235, 235)


def _post(client, image, frames=2):
    files = [encode_jpeg(image) for _ in range(frames)]
    return client.post("/api/scanner/analyze/", {"images": files}, format="multipart")


def test_a_yellow_lit_photo_is_rejected_with_the_reason_and_the_checks(api_client, monkeypatch):
    image, detector = synthetic_face(SKIN, background_bgr=YELLOW_WALL)
    monkeypatch.setattr("scanner.services.get_detector", lambda: detector)

    response = _post(api_client, image)
    body = response.json()

    assert response.status_code == 422
    assert body["status"] == "failed" and body["reason"] == "cast"
    assert "yellow" in body["message"].lower()
    assert {check["key"] for check in body["quality"]["checks"]} == {"cast", "blur", "side_light", "pose"}


def test_a_good_photo_returns_its_checks_with_the_reading(api_client, monkeypatch):
    image, detector = synthetic_face(SKIN, background_bgr=WHITE_WALL)
    monkeypatch.setattr("scanner.services.get_detector", lambda: detector)

    body = _post(api_client, image).json()

    assert body["status"] == "success"
    assert body["quality"]["ok"] is True
    assert set(body["quality"]) == {"ok", "checks", "confidence_factor", "failed"}


def test_thresholds_can_be_overridden_in_settings(api_client, monkeypatch, settings):
    image, detector = synthetic_face(SKIN, background_bgr=YELLOW_WALL)
    monkeypatch.setattr("scanner.services.get_detector", lambda: detector)
    settings.SKIN_SCAN_QUALITY = {"cast_b_warm_warn": 60.0, "cast_b_warm_fail": 80.0}

    assert _post(api_client, image).json()["status"] == "success"
