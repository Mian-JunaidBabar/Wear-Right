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
};

export type CartItem = {
  product: CartProduct;
  quantity: number;
};
