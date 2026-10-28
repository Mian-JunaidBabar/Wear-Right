import { apiGet, apiSend } from "@/lib/api";
import type { ApiCategory, ApiStyle, ColourSuggestion } from "@/features/catalog/api";

/**
 * Every call the admin panel makes. They all live under /api/admin/, where Django reads only the
 * admin session cookie and checks the member's role. Hiding a button in the UI is a convenience;
 * the API is the protection.
 */
const A = "/api/admin";

export type AdminPermission =
  | "dashboard.view"
  | "products.view"
  | "products.manage"
  | "catalog.manage"
  | "orders.view"
  | "orders.manage"
  | "bookings.view"
  | "bookings.manage"
  | "scans.view"
  | "team.manage";

export type AdminRoleBrief = { id: number | null; name: string; slug: string; is_system: boolean };

export type AdminSession = {
  user: { id: number; name: string; first_name: string; last_name: string; email: string; last_login: string | null };
  role: AdminRoleBrief;
  permissions: AdminPermission[];
};

export type AdminRole = AdminRoleBrief & {
  description: string;
  permissions: AdminPermission[];
  member_count: number;
  created_at: string;
};

export type PermissionInfo = { key: AdminPermission; group: string; label: string };

export type AdminMember = {
  id: number;
  name: string;
  email: string;
  role: AdminRoleBrief;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  is_self?: boolean;
};

export type ToneRule = { id: number; depth: "Fair" | "Medium" | "Dark"; undertone: "warm" | "cool" | "neutral"; color_name: string; score: 2 | 1 | -2 };

export const adminAuthApi = {
  login: (email: string, password: string) => apiSend<AdminSession>("POST", `${A}/auth/login/`, { email, password }),
  logout: () => apiSend<{ detail: string }>("POST", `${A}/auth/logout/`, {}),
  me: () => apiGet<AdminSession>(`${A}/auth/me/`),
  updateMe: (name: string) => apiSend<AdminSession>("PATCH", `${A}/auth/me/`, { name }),
  changePassword: (current_password: string, new_password: string) =>
    apiSend<{ status: string; message: string }>("POST", `${A}/auth/password/`, { current_password, new_password }),
  requestPasswordReset: (email: string) => apiSend<{ detail: string }>("POST", `${A}/auth/password/reset/`, { email }),
  confirmPasswordReset: (data: { uid: string; token: string; new_password1: string; new_password2: string }) =>
    apiSend<{ detail: string }>("POST", `${A}/auth/password/reset/confirm/`, data),
};

export const adminApi = {
  dashboard: <T = unknown>() => apiGet<T>(`${A}/dashboard/`),
  products: <T = unknown>() => apiGet<T>(`${A}/products/?page_size=500`),
  orders: <T = unknown>() => apiGet<T>(`${A}/orders/`),
  bookings: <T = unknown>() => apiGet<T>(`${A}/bookings/`),
  faceScans: <T = unknown>() => apiGet<T>(`${A}/face-scans/`),

  /** Creates (no id) or updates (id) a product. `formData` carries the optional image file. */
  saveProduct: (id: number | null, formData: FormData) =>
    id === null ? apiSend("POST", `${A}/products/`, formData) : apiSend("PUT", `${A}/products/${id}/`, formData),
  deleteProduct: (id: number) => apiSend("DELETE", `${A}/products/${id}/`),
  colourSuggestion: (image: File) => {
    const form = new FormData();
    form.append("image", image);
    return apiSend<{ status: string; suggestion: ColourSuggestion }>("POST", `${A}/products/color-suggestion/`, form);
  },

  updateBooking: (id: number, patch: { status: string }) => apiSend("PUT", `${A}/bookings/${id}/`, patch),
  deleteBooking: (id: number) => apiSend("DELETE", `${A}/bookings/${id}/`),

  updateOrderStatus: (id: number, order_status: string) => apiSend("PATCH", `${A}/orders/${id}/status/`, { order_status }),
  deleteOrder: (id: number) => apiSend("DELETE", `${A}/orders/${id}/`),

  categories: () => apiGet<{ status: string; categories: ApiCategory[] }>(`${A}/categories/?all=1`),
  createCategory: (data: Partial<ApiCategory>) => apiSend("POST", `${A}/categories/`, data),
  updateCategory: (id: number, data: Partial<ApiCategory>) => apiSend("PUT", `${A}/categories/${id}/`, data),
  deleteCategory: (id: number) => apiSend("DELETE", `${A}/categories/${id}/`),

  styles: () => apiGet<{ status: string; styles: ApiStyle[] }>(`${A}/styles/?all=1`),
  createStyle: (data: Partial<ApiStyle>) => apiSend("POST", `${A}/styles/`, data),
  updateStyle: (id: number, data: Partial<ApiStyle>) => apiSend("PUT", `${A}/styles/${id}/`, data),
  deleteStyle: (id: number) => apiSend("DELETE", `${A}/styles/${id}/`),

  toneRules: () => apiGet<{ status: string; rules: ToneRule[] }>(`${A}/tone-rules/`),
  createToneRule: (rule: Omit<ToneRule, "id">) => apiSend<{ status: string; rule: ToneRule }>("POST", `${A}/tone-rules/`, rule),
  updateToneRule: (id: number, patch: Partial<ToneRule>) => apiSend("PUT", `${A}/tone-rules/${id}/`, patch),
  deleteToneRule: (id: number) => apiSend("DELETE", `${A}/tone-rules/${id}/`),

  members: () => apiGet<{ status: string; members: AdminMember[] }>(`${A}/members/`),
  createMember: (data: {
    name: string;
    email: string;
    password?: string;
    role: number;
    is_active: boolean;
    email_invite?: boolean;
  }) => apiSend<{ status: string; member: AdminMember }>("POST", `${A}/members/`, data),
  updateMember: (id: number, data: Partial<{ name: string; role: number; is_active: boolean; password: string }>) =>
    apiSend<{ status: string; member: AdminMember }>("PATCH", `${A}/members/${id}/`, data),
  deleteMember: (id: number) => apiSend("DELETE", `${A}/members/${id}/`),

  roles: () => apiGet<{ status: string; roles: AdminRole[]; permissions: PermissionInfo[] }>(`${A}/roles/`),
  createRole: (data: { name: string; description: string; permissions: AdminPermission[] }) =>
    apiSend<{ status: string; role: AdminRole }>("POST", `${A}/roles/`, data),
  updateRole: (id: number, data: Partial<{ name: string; description: string; permissions: AdminPermission[] }>) =>
    apiSend<{ status: string; role: AdminRole }>("PATCH", `${A}/roles/${id}/`, data),
  deleteRole: (id: number) => apiSend("DELETE", `${A}/roles/${id}/`),
};
