"use client";

import { useState } from "react";
import { PLACEHOLDER_IMAGE, getProductImageUrl } from "@/lib/config";

type Props = {
  /** Image path from the API (/media/...) or an absolute URL. */
  src?: string | null;
  alt: string;
  /** Extra sizing/positioning classes; object-contain is the default so photos are never cropped. */
  className?: string;
};

/**
 * The one way to draw a product photo: if the file is missing on disk (an empty worktree
 * media folder, a broken upload), swap to the placeholder once instead of showing alt text.
 */
export default function ProductImage({ src, alt, className }: Props) {
  const [failed, setFailed] = useState(false);
  const url = failed || !src ? PLACEHOLDER_IMAGE : getProductImageUrl(src);

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => {
        if (!failed) setFailed(true);
      }}
      className={`object-contain ${className ?? ""}`}
    />
  );
}
