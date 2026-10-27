export type CartProduct = {
  id: number | string;
  name: string;
  category: string;
  style?: string;
  color?: string;
  garment_type?: string;
  cultural_tag?: string;
  compatible_skin_tone?: string;
  image_url?: string | null;
  image?: string | null;
  price: string | number;
  stock_quantity?: number;
  status?: string;
  /** Sizes offered by the product; the cart stores the chosen one. */
  sizes?: string[];
  size?: string;
};

export type CartItem = {
  /** Server cart row id (absent for a guest cart). */
  id?: number;
  size?: string;
  product: CartProduct;
  quantity: number;
};
