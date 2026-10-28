/** Turn API products into drawable try-on garments, loading each cut-out's natural size. */
import type { ApiItem } from "@/features/recommender/api";
import type { Garment, GarmentAnchors } from "./place";

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

export async function garmentsFromItems(items: ApiItem[]): Promise<{ garments: Garment[]; unavailable: ApiItem[] }> {
  const garments: Garment[] = [];
  const unavailable: ApiItem[] = [];
  for (const item of items) {
    if (!item.tryon_ready || !item.mannequin_image) {
      unavailable.push(item);
      continue;
    }
    try {
      const image = await loadImage(item.mannequin_image);
      garments.push({
        id: item.id,
        name: item.name,
        kind: item.kind || item.slot || "",
        image: item.mannequin_image,
        anchors: (item.tryon_anchors ?? {}) as GarmentAnchors,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    } catch {
      unavailable.push(item);
    }
  }
  return { garments, unavailable };
}
