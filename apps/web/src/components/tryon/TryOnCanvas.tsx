"use client";

import React, { useEffect, useRef } from "react";
import type { Landmark } from "@/features/tryon/pose";
import { placeGarment, sortPlacements, type Garment } from "@/features/tryon/place";

type Props = {
  image?: HTMLImageElement | null;
  video?: HTMLVideoElement | null;
  landmarks: Landmark[] | null;
  garments: Garment[];
  mirrored?: boolean;
  onFps?: (fps: number) => void;
  label?: string;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
};

/**
 * Draws the camera/photo/model background and every placeable cut-out on top.
 *
 * The video is mirrored with CSS, so the same unmirrored landmarks drive both the user's view and
 * the saved photo. The canvas is drawn at the source resolution; CSS scales it to the panel.
 */
export default function TryOnCanvas({ image, video, landmarks, garments, mirrored = false, onFps, label, canvasRef: outerRef }: Props) {
  const localRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = outerRef ?? localRef;
  const frames = useRef(0);
  const started = useRef(0);
  const images = useRef(new Map<number, HTMLImageElement>());

  useEffect(() => {
    let cancelled = false;
    garments.forEach((garment) => {
      if (images.current.has(garment.id)) return;
      const element = new Image();
      element.src = garment.image;
      element.onload = () => {
        if (!cancelled) images.current.set(garment.id, element);
      };
    });
    return () => {
      cancelled = true;
    };
  }, [garments]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const source = video ?? image;
    if (!canvas || !source) return;
    const width = video ? video.videoWidth : image?.naturalWidth ?? 0;
    const height = video ? video.videoHeight : image?.naturalHeight ?? 0;
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);

    if (landmarks) {
      const placements = sortPlacements(
        garments.flatMap((garment) => {
          const element = images.current.get(garment.id);
          return element ? placeGarment({ garment, landmarks, canvas: { width, height } }) : [];
        }),
      );
      for (const placement of placements) {
        const element = images.current.get(placement.id);
        if (!element) continue;
        const [sx, sy, sw, sh] = placement.source;
        context.save();
        context.setTransform(...placement.matrix);
        context.drawImage(element, sx, sy, sw, sh, 0, 0, sw, sh);
        context.restore();
      }
    }

    if (video && onFps) {
      const now = performance.now();
      if (!started.current) started.current = now;
      frames.current += 1;
      if (now - started.current >= 700) {
        onFps(Math.round((frames.current * 1000) / (now - started.current)));
        frames.current = 0;
        started.current = now;
      }
    }
  }, [image, video, landmarks, garments, onFps, canvasRef]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="tryon-canvas"
      role="img"
      aria-label={label ?? "Outfit on a body"}
      className="w-full h-auto max-h-[70vh] object-contain rounded-2xl bg-slate-100"
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
    />
  );
}
