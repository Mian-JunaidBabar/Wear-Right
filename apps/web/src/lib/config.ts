/** Admin WhatsApp number for orders and customer inquiries. */
export const ADMIN_WHATSAPP_NUMBER: string =
  process.env.NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER || "923021191771";

export const PLACEHOLDER_IMAGE = "/images/placeholder-product.jpeg";

/** Backend endpoints. Relative on purpose: next.config.ts rewrites /api/* to Django. */
export const API_PATHS = {
  products: "/api/products/",
  orders: "/api/orders/",
  bookings: "/api/bookings/",
  profiles: "/api/profiles/",
  faceScans: "/api/face-scans/",
  scannerAnalyze: "/api/scanner/analyze/",
  adminDashboard: "/api/admin/dashboard/",
  outfitGenerate: (productId: string | number) => `/api/outfit/generate/?product_id=${productId}`,
} as const;

/** Resolves a product image path from the API (/media/...) or an absolute URL. */
export function getProductImageUrl(imagePath?: string | null): string {
  if (!imagePath) return PLACEHOLDER_IMAGE;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) return imagePath;
  return imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
}
