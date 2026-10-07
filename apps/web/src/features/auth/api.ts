import { apiGet, apiSend } from "@/lib/api";

export type ApiUser = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
  is_staff: boolean;
  is_superuser: boolean;
};

export type ApiProfile = {
  id: number;
  user: number;
  skin_tone: string | null;
  cultural_preference: string;
  gender: "male" | "female" | "unspecified";
  preferred_style: "casual" | "formal" | "eastern" | "mixed";
  top_size: string;
  bottom_size: string;
  shoe_size: string;
};

export type Session = { user: ApiUser; profile: ApiProfile };

export type ProfilePatch = Partial<
  Pick<
    ApiProfile,
    "skin_tone" | "cultural_preference" | "gender" | "preferred_style" | "top_size" | "bottom_size" | "shoe_size"
  >
> & { name?: string };

export const authApi = {
  me: () => apiGet<Session>("/api/auth/me/"),

  /** `identifier` is an email address or a username. */
  login: (identifier: string, password: string) =>
    apiSend<Session>("POST", "/api/auth/login/", {
      ...(identifier.includes("@") ? { email: identifier } : { username: identifier }),
      password,
    }),

  register: (input: { name: string; email: string; password: string }) =>
    apiSend<Session>("POST", "/api/auth/register/", input),

  logout: () => apiSend<{ detail: string }>("POST", "/api/auth/logout/", {}),

  updateMe: (patch: ProfilePatch) => apiSend<Session>("PATCH", "/api/auth/me/", patch),
};
