export type ViewType =
  | "home"
  | "auth"
  | "profile"
  | "facescan"
  | "shop"
  | "recommended"
  | "complete-outfit"
  | "order-confirmation"
  | "my-orders"
  | "wishlist"
  | "about"
  | "contact"
  | "admin";

/** What the UI knows about whoever is browsing. Guests have isLoggedIn: false. */
export interface UserState {
  id: number | null;
  name: string;
  email: string;
  avatar: string;
  role: string;
  isLoggedIn: boolean;
  isStaff: boolean;
  /** Detected skin tone (Fair | Medium | Dark); from a scan this visit or the saved profile. */
  contrastType?: string;
}

/** Card shape used by the shop grid. */
export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  match: number;
  style: "Eastern" | "Western" | "Casual" | "Formal";
  colors: string[];
}
