import io

import cv2
import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from scanner.engine.evaluation import evaluate, load_labels, to_markdown
from scanner.engine.skin import MONK_SWATCHES
from scanner.tests.fakes import synthetic_face


def _ok(depth, monk=5, undertone="warm", confidence=100.0):
    return {"ok": True, "depth": depth, "monk": monk, "undertone": undertone, "confidence": confidence}


def _rows():
    return [
        {"file": "a.jpg", "depth": "Fair", "monk": "5", "undertone": "warm", "lighting": "daylight"},
        {"file": "b.jpg", "depth": "Fair", "monk": "3", "undertone": "cool", "lighting": "daylight"},
        {"file": "c.jpg", "depth": "Medium", "monk": "6", "undertone": "warm", "lighting": "indoor"},
        {"file": "d.jpg", "depth": "Dark", "monk": "8", "undertone": "warm", "lighting": "indoor"},
    ]


def test_metrics_are_computed_from_the_results():
    answers = {
        "a.jpg": _ok("Fair", monk=5, undertone="warm", confidence=100),
        "b.jpg": _ok("Medium", monk=5, undertone="warm", confidence=80),   # wrong depth, monk off by 2, wrong undertone
        "c.jpg": _ok("Medium", monk=7, undertone="warm", confidence=90),   # right depth, monk off by 1
        "d.jpg": {"ok": False, "reason": "too_dark"},
    }

    report = evaluate(_rows(), lambda row: answers[row["file"]])

    assert report["images"] == 4 and report["usable"] == 3 and report["usable_rate"] == 0.75
    assert report["rejected"] == {"too_dark": 1}
    assert report["depth_accuracy"] == pytest.approx(0.6667, abs=1e-4)
    assert report["depth_accuracy_counting_rejects_as_wrong"] == 0.5
    assert report["confusion"]["Fair"] == {"Fair": 1, "Medium": 1, "Dark": 0}
    assert report["confusion"]["Medium"]["Medium"] == 1
    assert report["monk_exact"] == pytest.approx(0.3333, abs=1e-4) and report["monk_within_1"] == pytest.approx(0.6667, abs=1e-4)
    assert report["undertone_accuracy"] == pytest.approx(0.6667, abs=1e-4)
    assert report["by_lighting"]["daylight"] == {"images": 2, "usable": 2, "depth_accuracy": 0.5}
    assert report["by_lighting"]["indoor"] == {"images": 2, "usable": 1, "depth_accuracy": 1.0}
    assert report["mean_confidence_by_depth"] == {"Fair": 90.0, "Medium": 90.0}


def test_an_empty_set_of_usable_images_gives_no_accuracy_instead_of_a_made_up_one():
    report = evaluate(_rows(), lambda row: {"ok": False, "reason": "no_face"})
    assert report["depth_accuracy"] is None and report["monk_exact"] is None and report["usable"] == 0
    assert "n/a" in to_markdown(report)


def test_the_markdown_report_has_the_confusion_matrix_and_lighting_table():
    report = evaluate(_rows(), lambda row: _ok(row["depth"]))
    text = to_markdown(report)
    assert "| labelled \\ predicted | Fair | Medium | Dark |" in text
    assert "| daylight | 2 | 2 | 100.0% |" in text
    assert "Depth accuracy on usable images: **100.0%**" in text


@pytest.mark.parametrize(
    ("content", "message"),
    [
        ("file,color\na.jpg,Fair\n", "depth"),
        ("file,depth\na.jpg,Tan\n", "depth must be"),
        ("file,depth,undertone\na.jpg,Fair,purple\n", "undertone"),
        ("file,depth,monk\na.jpg,Fair,11\n", "monk"),
    ],
)
def test_bad_label_files_are_rejected_with_a_reason(tmp_path, content, message):
    path = tmp_path / "labels.csv"
    path.write_text(content, encoding="utf-8")
    with pytest.raises(ValueError, match=message):
        load_labels(path)


@pytest.fixture
def photo_folder(tmp_path, monkeypatch):
    """Synthetic labelled photos: faces painted with Monk swatches 2, 5 and 8. Labels come from the swatch order."""
    rows = [("fair.jpg", 1, "Fair", 2), ("mid.jpg", 4, "Fair", 5), ("dark.jpg", 7, "Dark", 8)]
    lines = ["file,depth,monk,undertone,lighting"]
    detector = None
    for name, swatch_index, depth, monk in rows:
        hex_value = MONK_SWATCHES[swatch_index]
        image, detector = synthetic_face(tuple(int(hex_value[i:i + 2], 16) for i in (5, 3, 1)))
        cv2.imwrite(str(tmp_path / name), image)
        lines.append(f"{name},{depth},{monk},warm,studio")
    (tmp_path / "labels.csv").write_text("\n".join(lines) + "\n", encoding="utf-8")
    monkeypatch.setattr("scanner.management.commands.evaluate_skin_tone.get_detector", lambda: detector)
    return tmp_path


def test_the_command_prints_a_report_and_writes_the_file(photo_folder):
    out = io.StringIO()
    target = photo_folder / "report.md"

    call_command("evaluate_skin_tone", dir=str(photo_folder), out=str(target), stdout=out)

    text = out.getvalue()
    assert "Images: 3. Usable (not rejected): 3" in text
    assert "Depth accuracy on usable images: **100.0%**" in text
    assert "background white balance off" in text
    assert target.read_text(encoding="utf-8").startswith("# Skin tone evaluation")


def test_the_command_can_compare_balancing_on_and_off(photo_folder):
    out = io.StringIO()
    call_command("evaluate_skin_tone", dir=str(photo_folder), white_balance="both", stdout=out)
    assert "white balance off" in out.getvalue() and "white balance on" in out.getvalue()


def test_the_command_needs_a_labels_file(tmp_path):
    with pytest.raises(CommandError, match="labels.csv"):
        call_command("evaluate_skin_tone", dir=str(tmp_path), stdout=io.StringIO())
