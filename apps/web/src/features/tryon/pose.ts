/**
 * MediaPipe Pose Landmarker, loaded from files served by this app.
 *
 * Nothing is fetched from a CDN at runtime: `make models` copies the tasks-vision wasm into
 * `public/mediapipe/wasm` and downloads the lite pose model next to it. Keeping the model local
 * makes the demo work without internet and means camera frames never leave the browser.
 */
import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

export type Landmark = NormalizedLandmark;
export type PoseResult = PoseLandmarkerResult;

let fileset: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;

function loadFileset() {
  if (!fileset) fileset = FilesetResolver.forVisionTasks("/mediapipe/wasm");
  return fileset;
}

async function create(mode: "VIDEO" | "IMAGE"): Promise<PoseLandmarker> {
  const vision = await loadFileset();
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "/mediapipe/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: mode,
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
}

/** A detector for a sequence of video frames; call `detectForVideo(video, timestamp)`. */
export function createVideoPoseLandmarker(): Promise<PoseLandmarker> {
  return create("VIDEO");
}

/** A one-shot detector for an uploaded still; the caller closes it after `detect()`. */
export function createImagePoseLandmarker(): Promise<PoseLandmarker> {
  return create("IMAGE");
}

/** The first pose's landmarks, or null when the model found no body. */
export function firstPose(result: PoseResult): Landmark[] | null {
  return result.landmarks?.[0] ?? null;
}

/** MediaPipe landmark indices used by the layer placement. */
export const POSE = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFoot: 31,
  rightFoot: 32,
} as const;
