import { describe, expect, it } from "vitest";
import { POSE, type Landmark } from "./pose";
import { affine, placeGarment, sortPlacements, transformPoint, type Garment } from "./place";
import { LandmarkSmoother } from "./smooth";

const canvas = { width: 400, height: 800 };

function landmark(x: number, y: number, visibility = 1): Landmark {
  return { x, y, visibility };
}

function body(): Landmark[] {
  const points: Landmark[] = Array.from({ length: 33 }, () => landmark(0.5, 0.5));
  points[POSE.leftShoulder] = landmark(0.3, 0.2);
  points[POSE.rightShoulder] = landmark(0.7, 0.2);
  points[POSE.leftHip] = landmark(0.35, 0.5);
  points[POSE.rightHip] = landmark(0.65, 0.5);
  points[POSE.leftKnee] = landmark(0.4, 0.7);
  points[POSE.rightKnee] = landmark(0.6, 0.7);
  points[POSE.leftAnkle] = landmark(0.4, 0.9);
  points[POSE.rightAnkle] = landmark(0.6, 0.9);
  points[POSE.leftHeel] = landmark(0.35, 0.9);
  points[POSE.rightHeel] = landmark(0.65, 0.9);
  points[POSE.leftFoot] = landmark(0.3, 0.92);
  points[POSE.rightFoot] = landmark(0.7, 0.92);
  points[POSE.leftElbow] = landmark(0.4, 0.35);
  points[POSE.rightElbow] = landmark(0.6, 0.35);
  points[POSE.leftWrist] = landmark(0.4, 0.5);
  points[POSE.rightWrist] = landmark(0.6, 0.5);
  points[POSE.leftEar] = landmark(0.4, 0.1);
  points[POSE.rightEar] = landmark(0.6, 0.1);
  return points;
}

function garment(kind: string, anchors: Garment["anchors"], width = 200, height = 300): Garment {
  return { id: 1, name: "Test", kind, image: "/media/test.png", anchors, width, height };
}

describe("affine", () => {
  it("maps the three source anchors exactly onto their targets", () => {
    const src = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 200 }] as const;
    const dst = [{ x: 20, y: 30 }, { x: 180, y: 40 }, { x: 90, y: 300 }] as const;
    const matrix = affine([...src], [...dst]);
    src.forEach((point, index) => {
      const moved = transformPoint(matrix, point);
      expect(moved.x).toBeCloseTo(dst[index].x, 5);
      expect(moved.y).toBeCloseTo(dst[index].y, 5);
    });
  });
});

describe("placing a top", () => {
  it("maps the shoulders just outside the bone points and the hem to the hips", () => {
    const [placement] = placeGarment({
      garment: garment("shirt", {
        l_shoulder: [20, 10], r_shoulder: [180, 10], hem_center: [100, 290],
      }),
      landmarks: body(), canvas,
    });
    expect(transformPoint(placement.matrix, { x: 20, y: 10 })).toEqual({ x: 113.6, y: 160 });
    expect(transformPoint(placement.matrix, { x: 180, y: 10 })).toEqual({ x: 286.4, y: 160 });
    const hem = transformPoint(placement.matrix, { x: 100, y: 290 });
    expect(hem.x).toBeCloseTo(200, 5);
    expect(hem.y).toBeCloseTo(414.4, 5);
  });

  it("reports nothing when anchors or visible hips are missing", () => {
    const landmarks = body();
    landmarks[POSE.leftHip] = { ...landmarks[POSE.leftHip], visibility: 0.1 };
    expect(placeGarment({ garment: garment("shirt", {}), landmarks, canvas })).toEqual([]);
    expect(placeGarment({
      garment: garment("shirt", { l_shoulder: [0, 0], r_shoulder: [10, 0] }), landmarks, canvas,
    })).toEqual([]);
  });
});

describe("placing a bottom", () => {
  it("widens the waistband and ends at the ankles", () => {
    const [placement] = placeGarment({
      garment: garment("jeans", { l_waist: [20, 10], r_waist: [180, 10], hem_center: [100, 290] }),
      landmarks: body(), canvas,
    });
    const left = transformPoint(placement.matrix, { x: 20, y: 10 });
    const right = transformPoint(placement.matrix, { x: 180, y: 10 });
    const hem = transformPoint(placement.matrix, { x: 100, y: 290 });
    expect(left.x).toBeCloseTo(131, 5);
    expect(left.y).toBeCloseTo(400, 5);
    expect(right.x).toBeCloseTo(269, 5);
    expect(right.y).toBeCloseTo(400, 5);
    expect(hem.x).toBeCloseTo(200, 5);
    expect(hem.y).toBeCloseTo(720, 5);
  });

  it("stops shorts at the knees", () => {
    const [placement] = placeGarment({
      garment: garment("shorts", { l_waist: [20, 10], r_waist: [180, 10], hem_center: [100, 290] }),
      landmarks: body(), canvas,
    });
    expect(transformPoint(placement.matrix, { x: 100, y: 290 })).toEqual({ x: 200, y: 560 });
  });
});

describe("placing shoes", () => {
  it("uses one shoe crop per foot and maps heel/toe onto each foot", () => {
    const placements = placeGarment({
      garment: garment("sneakers", { heel: [5, 10], toe: [45, 10], shoe_box: [0, 0, 50, 20] }, 50, 20),
      landmarks: body(), canvas,
    });
    expect(placements).toHaveLength(2);
    expect(placements[0].source).toEqual([0, 0, 50, 20]);
    expect(transformPoint(placements[0].matrix, { x: 5, y: 10 })).toEqual({ x: 140, y: 720 });
    expect(transformPoint(placements[0].matrix, { x: 45, y: 10 })).toEqual({ x: 120, y: 736 });
    expect(transformPoint(placements[1].matrix, { x: 5, y: 10 })).toEqual({ x: 260, y: 720 });
    expect(transformPoint(placements[1].matrix, { x: 45, y: 10 })).toEqual({ x: 280, y: 736 });
  });
});

describe("placing a watch and a cap", () => {
  it("centres the watch on the wrist and follows the forearm", () => {
    const [placement] = placeGarment({
      garment: garment("watch", { center: [50, 50], strap_width: 20 }, 100, 100),
      landmarks: body(), canvas,
    });
    expect(transformPoint(placement.matrix, { x: 50, y: 50 })).toEqual({ x: 160, y: 400 });
    expect(placement.matrix[1]).toBeCloseTo(0, 5);
    expect(placement.matrix[0]).toBeCloseTo(0.6, 5);
  });

  it("centres the cap between the ears and scales it to the head", () => {
    const [placement] = placeGarment({
      garment: garment("cap", { center: [50, 25], width: 100 }, 100, 50),
      landmarks: body(), canvas,
    });
    expect(transformPoint(placement.matrix, { x: 50, y: 25 })).toEqual({ x: 200, y: 80 });
    expect(placement.matrix[0]).toBeCloseTo(1.36, 5);
  });
});

describe("draw order and unsupported kinds", () => {
  it("draws bottom, top, outerwear, shoes, watch", () => {
    const ordered = sortPlacements([
      { id: 5, name: "", kind: "watch", image: "", source: [0, 0, 1, 1], matrix: [1, 0, 0, 1, 0, 0], z: 50 },
      { id: 4, name: "", kind: "sneakers", image: "", source: [0, 0, 1, 1], matrix: [1, 0, 0, 1, 0, 0], z: 40 },
      { id: 1, name: "", kind: "jeans", image: "", source: [0, 0, 1, 1], matrix: [1, 0, 0, 1, 0, 0], z: 10 },
      { id: 3, name: "", kind: "jacket", image: "", source: [0, 0, 1, 1], matrix: [1, 0, 0, 1, 0, 0], z: 30 },
      { id: 2, name: "", kind: "shirt", image: "", source: [0, 0, 1, 1], matrix: [1, 0, 0, 1, 0, 0], z: 20 },
    ]);
    expect(ordered.map((placement) => placement.kind)).toEqual(["jeans", "shirt", "jacket", "sneakers", "watch"]);
  });

  it("returns nothing for bags and other items without a shape", () => {
    expect(placeGarment({ garment: garment("bag", {}), landmarks: body(), canvas })).toEqual([]);
  });
});

describe("LandmarkSmoother", () => {
  it("moves halfway to the new point and keeps visibility immediate", () => {
    const smoother = new LandmarkSmoother(0.5);
    const first = smoother.update([landmark(0, 0, 1)]);
    expect(first[0]).toMatchObject({ x: 0, y: 0 });
    const second = smoother.update([landmark(10, 20, 0.1)]);
    expect(second[0]).toMatchObject({ x: 5, y: 10, visibility: 0.1 });
    const third = smoother.update([landmark(10, 20)]);
    expect(third[0]).toMatchObject({ x: 7.5, y: 15 });
  });

  it("resets so a new body is not blended with the old one", () => {
    const smoother = new LandmarkSmoother(0.5);
    smoother.update([landmark(100, 100)]);
    smoother.reset();
    expect(smoother.update([landmark(0, 0)])[0]).toMatchObject({ x: 0, y: 0 });
  });
});
