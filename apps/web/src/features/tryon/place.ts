/**
 * Places a garment cut-out on a pose. Pure maths, no React and no canvas calls.
 *
 * Every placement is an affine matrix plus a source rectangle: the canvas component sets the
 * transform and draws that rectangle from the cut-out. Anchors are in cut-out pixels (from the
 * backend), landmarks are MediaPipe's normalised 0..1 points, and the canvas is in CSS pixels.
 */
import { POSE, type Landmark } from "./pose";

export type Point = { x: number; y: number };
export type Matrix = [number, number, number, number, number, number];
export type AnchorPoint = [number, number];
export type GarmentAnchors = Record<string, AnchorPoint | number | number[] | undefined | null>;

export type Garment = {
  id: number;
  name: string;
  kind: string;
  image: string;
  anchors: GarmentAnchors;
  width: number;
  height: number;
};

export type Placement = {
  id: number;
  name: string;
  kind: string;
  image: string;
  /** Crop inside the cut-out image. */
  source: [number, number, number, number];
  matrix: Matrix;
  z: number;
};

export type PlacementInput = {
  garment: Garment;
  landmarks: Landmark[];
  canvas: { width: number; height: number };
  /** Watch angle is measured from the elbow to this wrist; left wrist by default. */
  watchSide?: "left" | "right";
};

export const LAYER_Z: Record<string, number> = {
  bottom: 10, top: 20, outerwear: 30, footwear: 40, watch: 50, cap: 50,
};

const FAMILY_OF_KIND: Record<string, string> = {
  tshirt: "top", shirt: "top", polo: "top", kurta: "top", kameez: "top", dress: "top",
  jacket: "outerwear", blazer: "outerwear", waistcoat: "outerwear", hoodie: "outerwear",
  jeans: "bottom", trousers: "bottom", shorts: "bottom", shalwar: "bottom",
  sneakers: "footwear", formal_shoes: "footwear", sandals: "footwear", boots: "footwear",
  watch: "watch", cap: "cap",
};

export function familyOf(kind: string): string {
  return FAMILY_OF_KIND[kind] ?? "";
}

function point(anchors: GarmentAnchors, key: string): AnchorPoint | null {
  const value = anchors[key];
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [x, y] = value;
  return typeof x === "number" && typeof y === "number" ? [x, y] : null;
}

/** MediaPipe normalised point in canvas pixels. */
function pixel(landmarks: Landmark[], index: number, canvas: { width: number; height: number }): Point | null {
  const landmark = landmarks[index];
  if (!landmark) return null;
  return { x: landmark.x * canvas.width, y: landmark.y * canvas.height };
}

function visible(landmarks: Landmark[], ...indices: number[]): boolean {
  return indices.every((index) => (landmarks[index]?.visibility ?? 1) >= 0.3);
}

function middle(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function along(from: Point, to: Point, ratio: number): Point {
  return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
}

function widen(a: Point, b: Point, factor: number): [Point, Point] {
  const centre = middle(a, b);
  return [
    { x: centre.x + (a.x - centre.x) * factor, y: centre.y + (a.y - centre.y) * factor },
    { x: centre.x + (b.x - centre.x) * factor, y: centre.y + (b.y - centre.y) * factor },
  ];
}

/** Affine matrix mapping three non-collinear source points onto three target points. */
export function affine(src: [Point, Point, Point], dst: [Point, Point, Point]): Matrix {
  const [p1, p2, p3] = src;
  const [q1, q2, q3] = dst;
  const denominator = (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  if (Math.abs(denominator) < 1e-9) {
    return [1, 0, 0, 1, 0, 0];
  }
  const a = ((q1.x - q3.x) * (p2.y - p3.y) - (q2.x - q3.x) * (p1.y - p3.y)) / denominator;
  const c = ((p1.x - p3.x) * (q2.x - q3.x) - (p2.x - p3.x) * (q1.x - q3.x)) / denominator;
  const b = ((q1.y - q3.y) * (p2.y - p3.y) - (q2.y - q3.y) * (p1.y - p3.y)) / denominator;
  const d = ((p1.x - p3.x) * (q2.y - q3.y) - (p2.x - p3.x) * (q1.y - q3.y)) / denominator;
  return [a, b, c, d, q3.x - a * p3.x - c * p3.y, q3.y - b * p3.x - d * p3.y];
}

export function transformPoint(matrix: Matrix, point: Point): Point {
  return {
    x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
    y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
  };
}

/** Similarity transform (no skew) from one vector to another. Used for shoes. */
function similarity(source: { heel: Point; toe: Point }, target: { heel: Point; toe: Point }): Matrix {
  const sx = source.toe.x - source.heel.x;
  const sy = source.toe.y - source.heel.y;
  const tx = target.toe.x - target.heel.x;
  const ty = target.toe.y - target.heel.y;
  const sourceLength = Math.hypot(sx, sy) || 1;
  const targetLength = Math.hypot(tx, ty) || sourceLength;
  const scale = targetLength / sourceLength;
  const angle = Math.atan2(ty, tx) - Math.atan2(sy, sx);
  const cos = Math.cos(angle) * scale;
  const sin = Math.sin(angle) * scale;
  return [
    cos, sin, -sin, cos,
    target.heel.x - (cos * source.heel.x - sin * source.heel.y),
    target.heel.y - (sin * source.heel.x + cos * source.heel.y),
  ];
}

function topPlacement({ garment, landmarks, canvas }: PlacementInput): Placement | null {
  const { l_shoulder, r_shoulder, hem_center } = {
    l_shoulder: point(garment.anchors, "l_shoulder"),
    r_shoulder: point(garment.anchors, "r_shoulder"),
    hem_center: point(garment.anchors, "hem_center"),
  };
  if (!l_shoulder || !r_shoulder || !hem_center) return null;
  if (!visible(landmarks, POSE.leftShoulder, POSE.rightShoulder, POSE.leftHip, POSE.rightHip)) return null;
  const left = pixel(landmarks, POSE.leftShoulder, canvas);
  const right = pixel(landmarks, POSE.rightShoulder, canvas);
  const leftHip = pixel(landmarks, POSE.leftHip, canvas);
  const rightHip = pixel(landmarks, POSE.rightHip, canvas);
  if (!left || !right || !leftHip || !rightHip) return null;
  const [wideLeft, wideRight] = widen(left, right, 1.08);
  const hips = middle(leftHip, rightHip);
  const shoulderMid = middle(left, right);
  const hem = along(shoulderMid, hips, 1.06);
  return {
    id: garment.id,
    name: garment.name,
    kind: garment.kind,
    image: garment.image,
    source: [0, 0, garment.width, garment.height],
    matrix: affine([{ x: l_shoulder[0], y: l_shoulder[1] }, { x: r_shoulder[0], y: r_shoulder[1] }, { x: hem_center[0], y: hem_center[1] }], [wideLeft, wideRight, hem]),
    z: LAYER_Z[familyOf(garment.kind)] ?? LAYER_Z.top,
  };
}

function bottomPlacement({ garment, landmarks, canvas }: PlacementInput): Placement | null {
  const lWaist = point(garment.anchors, "l_waist");
  const rWaist = point(garment.anchors, "r_waist");
  const hem = point(garment.anchors, "hem_center");
  if (!lWaist || !rWaist || !hem) return null;
  if (!visible(landmarks, POSE.leftHip, POSE.rightHip, POSE.leftKnee, POSE.rightKnee, POSE.leftAnkle, POSE.rightAnkle)) return null;
  const leftHip = pixel(landmarks, POSE.leftHip, canvas);
  const rightHip = pixel(landmarks, POSE.rightHip, canvas);
  const leftKnee = pixel(landmarks, POSE.leftKnee, canvas);
  const rightKnee = pixel(landmarks, POSE.rightKnee, canvas);
  const leftAnkle = pixel(landmarks, POSE.leftAnkle, canvas);
  const rightAnkle = pixel(landmarks, POSE.rightAnkle, canvas);
  if (!leftHip || !rightHip || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle) return null;
  const [wideLeft, wideRight] = widen(leftHip, rightHip, 1.15);
  const end = garment.kind === "shorts" ? middle(leftKnee, rightKnee) : middle(leftAnkle, rightAnkle);
  return {
    id: garment.id,
    name: garment.name,
    kind: garment.kind,
    image: garment.image,
    source: [0, 0, garment.width, garment.height],
    matrix: affine([{ x: lWaist[0], y: lWaist[1] }, { x: rWaist[0], y: rWaist[1] }, { x: hem[0], y: hem[1] }], [wideLeft, wideRight, end]),
    z: LAYER_Z.bottom,
  };
}

function shoePlacements({ garment, landmarks, canvas }: PlacementInput): Placement[] {
  const heel = point(garment.anchors, "heel");
  const toe = point(garment.anchors, "toe");
  const box = garment.anchors.shoe_box;
  if (!heel || !toe || !Array.isArray(box) || box.length !== 4) return [];
  if (!visible(landmarks, POSE.leftHeel, POSE.rightHeel, POSE.leftFoot, POSE.rightFoot)) return [];
  const [bx, by, bw, bh] = box as number[];
  if (bw <= 0 || bh <= 0) return [];
  const localHeel = { x: heel[0] - bx, y: heel[1] - by };
  const localToe = { x: toe[0] - bx, y: toe[1] - by };
  const placements: Placement[] = [];
  for (const [heelIndex, footIndex] of [[POSE.leftHeel, POSE.leftFoot], [POSE.rightHeel, POSE.rightFoot]] as const) {
    const targetHeel = pixel(landmarks, heelIndex, canvas);
    const targetToe = pixel(landmarks, footIndex, canvas);
    if (!targetHeel || !targetToe) continue;
    placements.push({
      id: garment.id,
      name: garment.name,
      kind: garment.kind,
      image: garment.image,
      source: [bx, by, bw, bh],
      matrix: similarity({ heel: localHeel, toe: localToe }, { heel: targetHeel, toe: targetToe }),
      z: LAYER_Z.footwear,
    });
  }
  return placements;
}

function watchPlacement({ garment, landmarks, canvas, watchSide = "left" }: PlacementInput): Placement | null {
  const centre = point(garment.anchors, "center");
  if (!centre) return null;
  const wristIndex = watchSide === "left" ? POSE.leftWrist : POSE.rightWrist;
  const elbowIndex = watchSide === "left" ? POSE.leftElbow : POSE.rightElbow;
  if (!visible(landmarks, wristIndex, elbowIndex)) return null;
  const wrist = pixel(landmarks, wristIndex, canvas);
  const elbow = pixel(landmarks, elbowIndex, canvas);
  if (!wrist || !elbow) return null;
  const forearm = Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y);
  const width = Math.max(12, forearm * 0.5);
  const scale = width / Math.max(1, garment.width);
  const angle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x) - Math.PI / 2;
  const cos = Math.cos(angle) * scale;
  const sin = Math.sin(angle) * scale;
  return {
    id: garment.id,
    name: garment.name,
    kind: garment.kind,
    image: garment.image,
    source: [0, 0, garment.width, garment.height],
    matrix: [
      cos, sin, -sin, cos,
      wrist.x - (cos * centre[0] - sin * centre[1]),
      wrist.y - (sin * centre[0] + cos * centre[1]),
    ],
    z: LAYER_Z.watch,
  };
}

function capPlacement({ garment, landmarks, canvas }: PlacementInput): Placement | null {
  const centre = point(garment.anchors, "center");
  if (!centre) return null;
  if (!visible(landmarks, POSE.leftEar, POSE.rightEar)) return null;
  const left = pixel(landmarks, POSE.leftEar, canvas);
  const right = pixel(landmarks, POSE.rightEar, canvas);
  if (!left || !right) return null;
  const head = middle(left, right);
  const targetWidth = Math.max(20, Math.hypot(right.x - left.x, right.y - left.y) * 1.7);
  const scale = targetWidth / Math.max(1, garment.width);
  const angle = Math.atan2(right.y - left.y, right.x - left.x);
  const cos = Math.cos(angle) * scale;
  const sin = Math.sin(angle) * scale;
  return {
    id: garment.id,
    name: garment.name,
    kind: garment.kind,
    image: garment.image,
    source: [0, 0, garment.width, garment.height],
    matrix: [
      cos, sin, -sin, cos,
      head.x - (cos * centre[0] - sin * centre[1]),
      head.y - (sin * centre[0] + cos * centre[1]),
    ],
    z: LAYER_Z.cap,
  };
}

/** Every layer for one garment: two shoes, or one top/bottom/watch/cap. */
export function placeGarment(input: PlacementInput): Placement[] {
  switch (familyOf(input.garment.kind)) {
    case "top":
    case "outerwear": {
      const placement = topPlacement(input);
      return placement ? [placement] : [];
    }
    case "bottom": {
      const placement = bottomPlacement(input);
      return placement ? [placement] : [];
    }
    case "footwear":
      return shoePlacements(input);
    case "watch": {
      const placement = watchPlacement(input);
      return placement ? [placement] : [];
    }
    case "cap": {
      const placement = capPlacement(input);
      return placement ? [placement] : [];
    }
    default:
      return [];
  }
}

/** Back to front. Stable for equal z so the caller's item order is preserved. */
export function sortPlacements(placements: Placement[]): Placement[] {
  return placements
    .map((placement, index) => ({ placement, index }))
    .sort((a, b) => a.placement.z - b.placement.z || a.index - b.index)
    .map(({ placement }) => placement);
}
