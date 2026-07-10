export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  match: number;
  style: 'Eastern' | 'Western' | 'Casual' | 'Formal';
  colors: string[];
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  image: string;
  colors: string[];
  tags: string[];
}

export type ViewType =
  | 'home'
  | 'auth'
  | 'profile'
  | 'facescan'
  | 'shop'
  | 'recommended'
  | 'complete-outfit'
  | 'order-confirmation'
  | 'my-orders'
  | 'wishlist'
  | 'about'
  | 'contact'
  | 'admin';

export interface UserState {
  name: string;
  email: string;
  avatar: string;
  role: string;
  isLoggedIn: boolean;
  contrastType?: string;
}