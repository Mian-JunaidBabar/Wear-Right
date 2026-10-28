/**
 * Exponential smoothing for pose landmarks.
 *
 * MediaPipe jitters by a pixel or two per frame even on a still body. Blending each new point
 * with the previous one removes most of that without adding a visible lag: alpha 0.5 means the
 * displayed point is halfway between old and new each frame.
 */
import type { Landmark } from "./pose";

export type SmoothedLandmark = Landmark;

/**
 * Keeps the last display position per landmark index. Visibility is not smoothed: a body part
 * leaving the frame should hide its garment immediately, not fade out of existence.
 */
export class LandmarkSmoother {
  private previous: Map<number, { x: number; y: number; z?: number }> = new Map();
  private readonly alpha: number;

  constructor(alpha = 0.5) {
    this.alpha = Math.min(1, Math.max(0, alpha));
  }

  update(landmarks: Landmark[]): Landmark[] {
    return landmarks.map((landmark, index) => {
      const previous = this.previous.get(index);
      const next = previous
        ? { ...landmark, x: previous.x + (landmark.x - previous.x) * this.alpha, y: previous.y + (landmark.y - previous.y) * this.alpha }
        : landmark;
      this.previous.set(index, { x: next.x, y: next.y, z: next.z });
      return next;
    });
  }

  reset(): void {
    this.previous.clear();
  }
}
