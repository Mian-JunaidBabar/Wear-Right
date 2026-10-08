"""Accuracy metrics for the skin tone pipeline against a labelled photo set. Pure Python, no Django.

labels.csv columns: file, depth (Fair|Medium|Dark), and optionally monk (1-10), undertone (warm|cool|neutral),
lighting (any group name, such as "daylight" or "indoor"). Every number in the report comes from this code.
"""
import csv
from collections import Counter, defaultdict
from pathlib import Path

DEPTHS = ("Fair", "Medium", "Dark")
UNDERTONES = ("warm", "cool", "neutral")


def load_labels(path):
    """Rows of the labels file as dicts. Raises ValueError for a missing column or an unknown label."""
    with open(path, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        missing = [c for c in ("file", "depth") if c not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"{path} has no column(s): {', '.join(missing)}")
        rows = []
        for number, row in enumerate(reader, start=2):
            if row["depth"] not in DEPTHS:
                raise ValueError(f"{path} line {number}: depth must be one of {', '.join(DEPTHS)}, got {row['depth']!r}")
            if row.get("undertone") and row["undertone"] not in UNDERTONES:
                raise ValueError(f"{path} line {number}: undertone must be one of {', '.join(UNDERTONES)}")
            if row.get("monk") and not (row["monk"].isdigit() and 1 <= int(row["monk"]) <= 10):
                raise ValueError(f"{path} line {number}: monk must be 1 to 10")
            rows.append(row)
    return rows


def _rate(hits, total):
    return round(hits / total, 4) if total else None


def evaluate(rows, analyze):
    """Run analyze(row) -> pipeline result for each labelled row and compute the metrics."""
    outcomes = [(row, analyze(row)) for row in rows]
    usable = [(row, result) for row, result in outcomes if result.get("ok")]
    confusion = {truth: Counter() for truth in DEPTHS}
    depth_hits = 0
    for row, result in usable:
        confusion[row["depth"]][result["depth"]] += 1
        depth_hits += row["depth"] == result["depth"]

    monk_rows = [(r, res) for r, res in usable if r.get("monk")]
    tone_rows = [(r, res) for r, res in usable if r.get("undertone")]
    by_lighting = defaultdict(list)
    for row, result in outcomes:
        by_lighting[row.get("lighting") or "unlabelled"].append((row, result))
    confidence_by_depth = defaultdict(list)
    for row, result in usable:
        confidence_by_depth[row["depth"]].append(result["confidence"])

    return {
        "images": len(outcomes),
        "usable": len(usable),
        "usable_rate": _rate(len(usable), len(outcomes)),
        "rejected": dict(Counter(r.get("reason", "unknown") for _, r in outcomes if not r.get("ok"))),
        "depth_accuracy": _rate(depth_hits, len(usable)),
        "depth_accuracy_counting_rejects_as_wrong": _rate(depth_hits, len(outcomes)),
        "confusion": {truth: {guess: confusion[truth][guess] for guess in DEPTHS} for truth in DEPTHS},
        "monk_exact": _rate(sum(int(r["monk"]) == res["monk"] for r, res in monk_rows), len(monk_rows)),
        "monk_within_1": _rate(sum(abs(int(r["monk"]) - res["monk"]) <= 1 for r, res in monk_rows), len(monk_rows)),
        "monk_images": len(monk_rows),
        "undertone_accuracy": _rate(sum(r["undertone"] == res["undertone"] for r, res in tone_rows), len(tone_rows)),
        "undertone_images": len(tone_rows),
        "by_lighting": {
            group: {
                "images": len(items),
                "usable": sum(1 for _, res in items if res.get("ok")),
                "depth_accuracy": _rate(
                    sum(1 for r, res in items if res.get("ok") and r["depth"] == res["depth"]),
                    sum(1 for _, res in items if res.get("ok")),
                ),
            }
            for group, items in sorted(by_lighting.items())
        },
        "mean_confidence_by_depth": {
            depth: round(sum(values) / len(values), 1) for depth, values in confidence_by_depth.items()
        },
    }


def _pct(value):
    return "n/a" if value is None else f"{value * 100:.1f}%"


def to_markdown(report, title="Skin tone evaluation"):
    lines = [f"# {title}", "", f"Images: {report['images']}. Usable (not rejected): {report['usable']} ({_pct(report['usable_rate'])}).", ""]
    if report["rejected"]:
        lines.append("Rejected: " + ", ".join(f"{reason} {n}" for reason, n in sorted(report["rejected"].items())) + ".")
        lines.append("")
    lines += [
        f"- Depth accuracy on usable images: **{_pct(report['depth_accuracy'])}**",
        f"- Depth accuracy counting rejected images as wrong: {_pct(report['depth_accuracy_counting_rejects_as_wrong'])}",
        f"- Monk exact: {_pct(report['monk_exact'])}, within one swatch: {_pct(report['monk_within_1'])} ({report['monk_images']} labelled)",
        f"- Undertone accuracy: {_pct(report['undertone_accuracy'])} ({report['undertone_images']} labelled)",
        "", "## Depth confusion (rows: labelled, columns: predicted)", "",
        "| labelled \\ predicted | " + " | ".join(DEPTHS) + " |", "| --- | " + " | ".join("---" for _ in DEPTHS) + " |",
    ]
    for truth in DEPTHS:
        lines.append(f"| {truth} | " + " | ".join(str(report["confusion"][truth][g]) for g in DEPTHS) + " |")
    lines += ["", "## By lighting", "", "| lighting | images | usable | depth accuracy |", "| --- | --- | --- | --- |"]
    for group, stats in report["by_lighting"].items():
        lines.append(f"| {group} | {stats['images']} | {stats['usable']} | {_pct(stats['depth_accuracy'])} |")
    lines += ["", "## Mean confidence by labelled depth", ""]
    for depth in DEPTHS:
        if depth in report["mean_confidence_by_depth"]:
            lines.append(f"- {depth}: {report['mean_confidence_by_depth'][depth]}")
    lines.append("")
    return "\n".join(lines)


def image_path(directory, row):
    return Path(directory) / row["file"]
