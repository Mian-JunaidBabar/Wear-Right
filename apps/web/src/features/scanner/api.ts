import { apiSend } from "@/lib/api";
import { API_PATHS } from "@/lib/config";

export type ScanResponse = {
  status: "success" | "failed";
  detected_skin_tone?: string;
  depth?: "Fair" | "Medium" | "Dark";
  confidence_score?: number;
  confidence?: number;
  lighting_quality?: string;
  brightness?: number | string;
  message?: string;
  total_frames_analyzed?: number;
  /** Skin tone v2: Monk Skin Tone swatch (1 to 10), undertone, and why a scan failed. */
  monk?: number;
  undertone?: "warm" | "cool" | "neutral";
  agreement?: number;
  reason?: string;
  /** Colour palette chosen for the detected tone. */
  palette?: {
    best: Array<string | { name: string; hex: string | null }>;
    avoid: Array<string | { name: string; hex: string | null }>;
  };
};

/** Public endpoint: guests can scan; the server only stores the result for signed-in users. */
export const scannerApi = {
  analyze: (formData: FormData) => apiSend<ScanResponse>("POST", API_PATHS.scannerAnalyze, formData),
  /** Manual fallback for when no face is detected or the camera is unavailable. */
  manual: (depth: "Fair" | "Medium" | "Dark", undertone: "warm" | "cool" | "neutral") =>
    apiSend<ScanResponse>("POST", "/api/scanner/manual/", { depth, undertone }),
};
