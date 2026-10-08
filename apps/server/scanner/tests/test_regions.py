import numpy as np

from scanner.engine.regions import EXCLUDED, REGIONS, region_mask, region_polygons
from scanner.tests.fakes import HEIGHT, WIDTH, synthetic_landmarks


def test_there_are_three_regions_two_cheeks_and_a_forehead():
    assert set(REGIONS) == {"left_cheek", "right_cheek", "forehead"}
    assert all(0 <= i < 478 for indices in REGIONS.values() for i in indices)


def test_regions_and_excluded_landmarks_do_not_overlap():
    used = {i for indices in REGIONS.values() for i in indices}
    excluded = {i for indices in EXCLUDED.values() for i in indices}
    assert not used & excluded


def test_polygons_shrink_towards_their_centre():
    landmarks = synthetic_landmarks()
    full = region_polygons(landmarks, shrink=1.0)["left_cheek"]
    shrunk = region_polygons(landmarks, shrink=0.5)["left_cheek"]
    assert np.ptp(shrunk[:, 0]) < np.ptp(full[:, 0])
    assert np.allclose(shrunk.mean(axis=0), full.mean(axis=0), atol=1.0)


def test_the_mask_covers_the_regions_and_nothing_else():
    mask = region_mask(synthetic_landmarks(), (HEIGHT, WIDTH, 3))
    assert mask.shape == (HEIGHT, WIDTH)
    assert mask[290, 155] and mask[290, 245] and mask[115, 200]  # cheek, cheek, forehead centres
    assert not mask[180, 150]   # the eye strip
    assert not mask[400, 200]   # chin / mouth area
    assert not mask[50, 50]     # background
