/**
 * API and Environment Configuration
 *
 * Configurable via Vite environment variables:
 * - VITE_API_URL: Base URL for the Django backend (e.g. http://127.0.0.1:8000 or https://your-django-api.onrender.com)
 * - VITE_ADMIN_WHATSAPP_NUMBER: Admin WhatsApp phone number for orders and customer inquiries
 */

export const API_BASE_URL: string = (
  import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
).replace(/\/+$/, '');

export const ADMIN_WHATSAPP_NUMBER: string =
  import.meta.env.VITE_ADMIN_WHATSAPP_NUMBER || '923021191771';

export const API_ENDPOINTS = {
  products: `${API_BASE_URL}/api/products/`,
  orders: `${API_BASE_URL}/api/orders/`,
  bookings: `${API_BASE_URL}/api/bookings/`,
  profiles: `${API_BASE_URL}/api/profiles/`,
  faceScans: `${API_BASE_URL}/api/face-scans/`,
  scannerAnalyze: `${API_BASE_URL}/api/scanner/analyze/`,
  adminDashboard: `${API_BASE_URL}/api/admin/dashboard/`,
  outfitGenerate: (productId: string | number) =>
    `${API_BASE_URL}/api/outfit/generate/?product_id=${productId}`,
} as const;

/**
 * Resolves media image URLs correctly, whether relative or absolute.
 */
export function getProductImageUrl(imagePath?: string | null): string {
  if (!imagePath) {
    return `${API_BASE_URL}/products/images.jpeg`;
  }
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  return `${API_BASE_URL}/${cleanPath}`;
}

