"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, ImagePlus, Loader2, ShoppingCart, Sparkles } from "lucide-react";
import TryOnCanvas from "@/components/tryon/TryOnCanvas";
import { useCart } from "@/features/cart/useCart";
import { apiGet } from "@/lib/api";
import { useSearchParams } from "@/lib/navigation";
import { notify } from "@/lib/notify";
import { PLACEHOLDER_IMAGE } from "@/lib/config";
import type { ApiItem } from "@/features/recommender/api";
import type { CartProduct } from "@/features/cart/types";
import { bodyFor, loadBodies, type BodyGender, type BodyPreset, type ModelBody } from "@/features/tryon/bodies";
import { createImagePoseLandmarker, createVideoPoseLandmarker, firstPose, POSE, type Landmark } from "@/features/tryon/pose";
import type { Garment, GarmentAnchors } from "@/features/tryon/place";

type Tab = "model" | "photo" | "camera";
const TABS: { id: Tab; label: string }[] = [
  { id: "model", label: "Model" },
  { id: "photo", label: "Your photo" },
  { id: "camera", label: "Camera" },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

function toCartProduct(item: ApiItem): CartProduct {
  return {
    id: item.id,
    name: item.name,
    category: item.category || "Product",
    color: item.color_name || "",
    garment_type: item.slot || "",
    image: item.image || PLACEHOLDER_IMAGE,
    price: Number(item.price || 0),
    stock_quantity: Number(item.stock_quantity || 0),
    status: item.status || "Active",
  };
}

function bodyChoice(value: string | null): { gender: BodyGender; preset: BodyPreset } {
  if (value === "women-slim" || value === "women-plus" || value === "women-regular") {
    return { gender: "women", preset: value.split("-")[1] as BodyPreset };
  }
  if (value === "men-slim" || value === "men-plus" || value === "men-regular") {
    return { gender: "men", preset: value.split("-")[1] as BodyPreset };
  }
  if (value === "slim" || value === "plus" || value === "regular") return { gender: "men", preset: value };
  return { gender: "men", preset: "regular" };
}

/** /try-on: live AR, an uploaded photo, or a precomputed model photo. */
export default function TryOnView() {
  const [searchParams] = useSearchParams();
  const { addToCart } = useCart();
  const ids = useMemo(
    () => (searchParams.get("items") || "").split(",").map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0),
    [searchParams],
  );
  const initial = bodyChoice(searchParams.get("body"));
  const [tab, setTab] = useState<Tab>("model");
  const [gender, setGender] = useState<BodyGender>(initial.gender);
  const [preset, setPreset] = useState<BodyPreset>(initial.preset);
  const [bodies, setBodies] = useState<ModelBody[]>([]);
  const [bodyImage, setBodyImage] = useState<HTMLImageElement | null>(null);
  const [items, setItems] = useState<ApiItem[]>([]);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [unavailable, setUnavailable] = useState<ApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photoImage, setPhotoImage] = useState<HTMLImageElement | null>(null);
  const [photoLandmarks, setPhotoLandmarks] = useState<Landmark[] | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraLandmarks, setCameraLandmarks] = useState<Landmark[] | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  const body = bodyFor(bodies, gender, preset);

  useEffect(() => {
    let cancelled = false;
    loadBodies()
      .then((rows) => !cancelled && setBodies(rows))
      .catch(() => !cancelled && setBodies([]));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!body) return;
    loadImage(body.image)
      .then((image) => !cancelled && setBodyImage(image))
      .catch(() => !cancelled && setBodyImage(null));
    return () => {
      cancelled = true;
    };
  }, [body]);

  useEffect(() => {
    let cancelled = false;
    if (ids.length === 0) {
      Promise.resolve().then(() => {
        if (cancelled) return;
        setItems([]);
        setGarments([]);
        setUnavailable([]);
        setLoading(false);
      });
      return;
    }
    Promise.all(ids.map((id) => apiGet<{ product: ApiItem }>(`/api/products/${id}/`).then((body) => body.product).catch(() => null)))
      .then(async (rows) => {
        if (cancelled) return;
        const found = rows.filter((row): row is ApiItem => Boolean(row));
        const ready: Garment[] = [];
        const missing: ApiItem[] = [];
        for (const item of found) {
          if (!item.tryon_ready || !item.mannequin_image) {
            missing.push(item);
            continue;
          }
          try {
            const image = await loadImage(item.mannequin_image);
            ready.push({
              id: item.id,
              name: item.name,
              kind: item.kind || item.slot || "",
              image: item.mannequin_image,
              anchors: (item.tryon_anchors ?? {}) as GarmentAnchors,
              width: image.naturalWidth,
              height: image.naturalHeight,
            });
          } catch {
            missing.push(item);
          }
        }
        if (cancelled) return;
        setError("");
        setItems(found);
        setGarments(ready);
        setUnavailable(missing);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("We could not load these products.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  // Camera: permission, model load and the detection loop all live in this effect.
  useEffect(() => {
    if (tab !== "camera") return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let landmarker: Awaited<ReturnType<typeof createVideoPoseLandmarker>> | null = null;
    let frame = 0;
    (async () => {
      try {
        landmarker = await createVideoPoseLandmarker();
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        let last = -1;
        const tick = () => {
          if (cancelled || !video || !landmarker) return;
          if (video.currentTime !== last && video.readyState >= 2) {
            last = video.currentTime;
            try {
              setCameraLandmarks(firstPose(landmarker.detectForVideo(video, performance.now())));
            } catch {
              // A dropped frame is not fatal; the next one will try again.
            }
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
        setCameraError(denied
          ? "Camera permission was denied. Allow it in the browser, then switch back to Camera."
          : "The camera or pose model could not start. You can use Model or Your photo instead.");
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      landmarker?.close();
    };
  }, [tab]);

  async function handlePhoto(file: File | null) {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoLandmarks(null);
    try {
      const url = URL.createObjectURL(file);
      const image = await loadImage(url);
      setPhotoImage(image);
      const detector = await createImagePoseLandmarker();
      try {
        const result = detector.detect(image);
        setPhotoLandmarks(firstPose(result));
        if (!result.landmarks?.length) notify("No full body found. Stand back so your head and feet are in the photo.");
      } finally {
        detector.close();
      }
    } catch {
      notify("That photo could not be read. Try a JPEG or PNG.", "error");
    } finally {
      setPhotoBusy(false);
    }
  }

  const addWholeLook = () => {
    if (items.length === 0) return;
    items.forEach((item) => addToCart(toCartProduct(item)));
    notify("The whole look was added to your cart.");
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "wear-right-try-on.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const landmarks = tab === "camera" ? cameraLandmarks : tab === "photo" ? photoLandmarks : body?.landmarks ?? null;
  const kneesTracked = Boolean(
    landmarks
      && (landmarks[POSE.leftKnee]?.visibility ?? 0) >= 0.5
      && (landmarks[POSE.rightKnee]?.visibility ?? 0) >= 0.5,
  );

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-cream-base px-6 py-10 text-left font-sans">
      <div className="max-w-6xl mx-auto">
        <p className="text-[10px] uppercase tracking-widest text-sage-green font-black mb-2">Instant try-on</p>
        <h1 className="text-3xl sm:text-5xl font-black text-brand-dark tracking-tight">See it on you</h1>
        <p className="text-sm text-slate-500 font-semibold mt-3 max-w-2xl">
          Pick a model, upload a full-body photo, or turn on the camera. The outfit follows your pose; frames never leave this browser.
        </p>

        <div className="mt-7 flex flex-wrap gap-2" role="tablist" aria-label="Try-on mode">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => {
                if (entry.id === "camera") {
                  setCameraError("");
                  setCameraLandmarks(null);
                }
                setTab(entry.id);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border ${
                tab === entry.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-brand-border/60"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {error && <div className="mt-6 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm font-bold">{error}</div>}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
          <div className="bg-white border border-brand-border/60 rounded-3xl p-5 relative">
            {tab === "model" && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex gap-2" role="group" aria-label="Model body">
                    {(["slim", "regular", "plus"] as BodyPreset[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={preset === value}
                        onClick={() => setPreset(value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                          preset === value ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                    <select
                      aria-label="Model gender"
                      value={gender}
                      onChange={(event) => setGender(event.target.value as BodyGender)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-600"
                    >
                      <option value="men">Men</option>
                      <option value="women">Women</option>
                    </select>
                  </div>
                  {unavailable.length > 0 && (
                    <p className="text-[11px] font-semibold text-amber-700">Not available for try-on: {unavailable.map((item) => item.name).join(", ")}</p>
                  )}
                </div>
                {loading ? (
                  <div className="py-32 text-center text-sm font-bold text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading the look...
                  </div>
                ) : bodyImage && landmarks ? (
                  <TryOnCanvas canvasRef={canvasRef} image={bodyImage} landmarks={landmarks} garments={garments} label="Outfit on a model" />
                ) : (
                  <div className="py-32 text-center">
                    <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-600">Choose a look from the shop to try it on.</p>
                  </div>
                )}
              </>
            )}

            {tab === "photo" && (
              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <label className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer">
                    <ImagePlus className="w-4 h-4" /> Choose a photo
                    <input type="file" accept="image/*" className="sr-only" onChange={(event) => void handlePhoto(event.target.files?.[0] ?? null)} />
                  </label>
                  {photoImage && (
                    <button type="button" onClick={download} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600 border border-slate-200 px-3 py-2 rounded-xl">
                      <Download className="w-4 h-4" /> Download image
                    </button>
                  )}
                </div>
                {photoBusy ? (
                  <div className="py-32 text-center text-sm font-bold text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Finding your pose...
                  </div>
                ) : photoImage ? (
                  <TryOnCanvas canvasRef={canvasRef} image={photoImage} landmarks={photoLandmarks} garments={garments} label="Outfit on your photo" />
                ) : (
                  <div className="py-32 text-center">
                    <ImagePlus className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-600">Use a full-body photo with your head and feet visible.</p>
                    <p className="text-xs font-semibold text-slate-400 mt-1">The photo is processed in this browser and is not uploaded.</p>
                  </div>
                )}
              </div>
            )}

            {tab === "camera" && (
              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <p className="text-xs font-bold text-slate-500 flex items-center gap-2"><Camera className="w-4 h-4" /> Live camera</p>
                  <span data-testid="tryon-fps" className="text-[11px] font-black uppercase tracking-wider text-sage-green">
                    {fps === null ? "FPS —" : `FPS ${fps}`}
                  </span>
                </div>
                {cameraError ? (
                  <div role="alert" className="py-32 text-center px-6">
                    <Camera className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-600">{cameraError}</p>
                  </div>
                ) : (
                  <>
                    <video
                      ref={(element) => {
                        videoRef.current = element;
                        setVideoElement(element);
                      }}
                      playsInline
                      muted
                      className="hidden"
                      aria-hidden="true"
                    />
                    {cameraLandmarks ? (
                      <TryOnCanvas
                        canvasRef={canvasRef}
                        video={videoElement}
                        landmarks={cameraLandmarks}
                        garments={garments}
                        mirrored
                        onFps={setFps}
                        label="Live outfit on your camera"
                      />
                    ) : (
                      <div className="py-32 text-center text-sm font-bold text-slate-500 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Starting the camera...
                      </div>
                    )}
                    {!kneesTracked && (
                      <p data-testid="tryon-stand-back" className="mt-3 text-xs font-semibold text-amber-700">
                        Stand back so your knees are visible.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            <p className="mt-4 text-[11px] font-semibold text-slate-400">
              A 2D overlay, not cloth simulation: the garment follows your body but does not drape or fold.
            </p>
          </div>

          <aside className="space-y-4">
            <div className="bg-white border border-brand-border/60 rounded-3xl p-5">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-700 mb-3">This look</h2>
              {items.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">Open a product&apos;s preview and choose Try it on.</p>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <img src={item.mannequin_image || item.image || PLACEHOLDER_IMAGE} alt="" className="w-11 h-14 object-contain rounded-lg bg-cream-base" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-brand-dark truncate">{item.name}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {unavailable.some((missing) => missing.id === item.id) ? "Not available for try-on" : item.kind || item.slot}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={addWholeLook}
                  className="mt-5 w-full bg-brand-gold hover:opacity-90 text-white px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" /> Add whole look to cart
                </button>
              )}
            </div>
            <p className="text-[11px] font-semibold text-slate-500 px-1">
              Privacy: camera frames and uploaded photos are processed locally in your browser. Nothing is sent to the server.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
