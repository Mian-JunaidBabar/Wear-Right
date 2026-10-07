import { apiSend } from "@/lib/api";
import { API_PATHS } from "@/lib/config";

export type ScanResponse = {
  status: "success" | "failed";
  detected_skin_tone?: string;
  confidence_score?: number;
  lighting_quality?: string;
  brightness?: number | string;
  message?: string;
  total_frames_analyzed?: number;
};

/** Public endpoint: guests can scan; the server only stores the result for signed-in users. */
export const scannerApi = {
  analyze: (formData: FormData) => apiSend<ScanResponse>("POST", API_PATHS.scannerAnalyze, formData),
};
