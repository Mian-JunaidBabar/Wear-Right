import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Heart,
  Loader2,
  MessageCircle,
  PackageCheck,
  ShoppingCart,
  Sparkles,
  Star,
  ZoomIn,
  X,
  Plus,
  Minus,
  Zap,
  ShoppingBag,
  Shirt,
  ChevronRight,
} from 'lucide-react';
import { CartProduct } from '../App';

type ApiProduct = {
  id: number | string;
  name: string;
  category?: string;
  cultural_tag?: string;
  compatible_skin_tone?: string;
  style?: string;
  color?: string;
  garment_type?: string;
  price: string | number;
  image?: string | null;
  image_url?: string | null;
  stock_quantity?: number;
  status?: string;
};

type OutfitSlot = ApiProduct | null;

type OutfitData = {
  main_item?: ApiProduct | null;
  outfit?: {
    shirt?: OutfitSlot;
    pant?: OutfitSlot;
    shoes?: OutfitSlot;
    accessory?: OutfitSlot;
    coat_or_jacket?: OutfitSlot;
  };
};

type ProductDetailViewProps = {
  addToCart: (product: CartProduct) => void;
  wishlistItems: CartProduct[];
  toggleWishlist: (product: CartProduct) => void;
};

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

function formatPKR(value: string | number | undefined) {
  const num = Number(value || 0);
  return `Rs. ${num.toLocaleString('en-PK')}`;
}

function normalizeStyle(style?: string) {
  const value = String(style || 'Casual').toLowerCase();

  if (value.includes('eastern')) return 'Eastern';
  if (value.includes('western')) return 'Western';
  if (value.includes('formal')) return 'Formal';
  if (value.includes('casual')) return 'Casual';

  return 'Casual';
}

function getProductImage(product?: ApiProduct | null) {
  if (!product) return 'https://placehold.co/600x800?text=Wear+Right';

  return (
    product.image_url ||
    product.image ||
    'https://placehold.co/600x800?text=Wear+Right'
  );
}

function toCartProduct(product: ApiProduct): CartProduct {
  return {
    id: product.id,
    name: product.name,
    category: product.category || 'Wear Right Product',
    style: normalizeStyle(product.style || product.cultural_tag),
    color: product.color || '',
    garment_type: product.garment_type || '',
    cultural_tag: product.cultural_tag || '',
    compatible_skin_tone: product.compatible_skin_tone || '',
    image: getProductImage(product),
    image_url: product.image_url || product.image || null,
    price: product.price,
    stock_quantity: Number(product.stock_quantity || 0),
    status: product.status || 'Active',
  };
}

export default function ProductDetailView({
  addToCart,
  wishlistItems,
  toggleWishlist,
}: ProductDetailViewProps) {
  const navigate = useNavigate();
  const { id } = useParams();

  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [allProducts, setAllProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Feature 1: Image Zoom
  const [showZoom, setShowZoom] = useState(false);

  // Feature 2: Size Selector
  const [selectedSize, setSelectedSize] = useState('M');

  // Feature 3: Quantity Selector
  const [quantity, setQuantity] = useState(1);

  // Feature 6: Complete This Outfit
  const [outfitData, setOutfitData] = useState<OutfitData | null>(null);
  const [outfitLoading, setOutfitLoading] = useState(false);

  const isWishlistActive = useMemo(() => {
    return wishlistItems.some((item) => String(item.id) === String(id));
  }, [wishlistItems, id]);

  const isOutOfStock = useMemo(() => {
    if (!product) return false;

    return (
      Number(product.stock_quantity || 0) <= 0 ||
      product.status === 'Out of Stock' ||
      product.status === 'Inactive'
    );
  }, [product]);

  const maxQuantity = useMemo(() => {
    if (!product) return 1;
    return Math.max(1, Number(product.stock_quantity || 1));
  }, [product]);

  const cartProduct = useMemo<CartProduct | null>(() => {
    if (!product) return null;
    return toCartProduct(product);
  }, [product]);

  // Feature 5: You May Also Like — related products
  const relatedProducts = useMemo(() => {
    if (!product || allProducts.length === 0) return [];

    const productStyle = normalizeStyle(product.style || product.cultural_tag);
    const productCategory = product.category || '';

    return allProducts
      .filter((item) => {
        if (String(item.id) === String(product.id)) return false;
        if (item.status === 'Out of Stock' || item.status === 'Inactive') return false;

        const itemStyle = normalizeStyle(item.style || item.cultural_tag);
        const sameStyle = itemStyle === productStyle;
        const sameCategory = item.category === productCategory;

        return sameStyle || sameCategory;
      })
      .slice(0, 6);
  }, [product, allProducts]);

  const fetchProduct = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      const response = await fetch('http://127.0.0.1:8000/api/products/');

      if (!response.ok) {
        throw new Error('Products API response was not successful.');
      }

      const data = await response.json();
      const products: ApiProduct[] = data.products || [];

      setAllProducts(products);

      const foundProduct = products.find(
        (item: ApiProduct) => String(item.id) === String(id)
      );

      if (!foundProduct) {
        setProduct(null);
        setErrorMessage('Product not found.');
        return;
      }

      setProduct(foundProduct);
    } catch (error) {
      console.error('Product detail error:', error);
      setErrorMessage('Unable to load product details from backend API.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Feature 6: Fetch outfit
  const fetchOutfit = useCallback(async (productId: string | number) => {
    try {
      setOutfitLoading(true);

      const response = await fetch(
        `http://127.0.0.1:8000/api/outfit/generate/?product_id=${productId}`
      );

      if (!response.ok) {
        setOutfitData(null);
        return;
      }

      const data = await response.json();

      if (data.status === 'success') {
        setOutfitData(data);
      } else {
        setOutfitData(null);
      }
    } catch (error) {
      console.error('Outfit fetch error:', error);
      setOutfitData(null);
    } finally {
      setOutfitLoading(false);
    }
  }, []);

  useEffect(() => {
    setQuantity(1);
    setSelectedSize('M');
    setShowZoom(false);
    setOutfitData(null);
    fetchProduct();
  }, [id, fetchProduct]);

  useEffect(() => {
    if (product) {
      fetchOutfit(product.id);
    }
  }, [product, fetchOutfit]);

  // Close zoom on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowZoom(false);
      }
    };

    if (showZoom) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [showZoom]);

  const handleAddToCart = () => {
    if (!cartProduct || !product) return;

    if (isOutOfStock) {
      alert('This product is currently out of stock.');
      return;
    }

    for (let i = 0; i < quantity; i++) {
      addToCart(cartProduct);
    }
  };

  // Feature 4: Buy Now — direct checkout via Navbar's checkout flow
  const handleBuyNow = () => {
    if (!cartProduct || !product || isOutOfStock) return;

    // Add to cart first (quantity times)
    for (let i = 0; i < quantity; i++) {
      addToCart(cartProduct);
    }

    // Navigate to shop where user can proceed from cart drawer
    alert(`${product.name} (x${quantity}) added to cart. Open the cart to checkout!`);
  };

  const handleWishlist = () => {
    if (!cartProduct) return;

    toggleWishlist(cartProduct);
  };

  const openWhatsApp = () => {
    if (!product) return;

    const adminWhatsAppNumber = '923021191771';

    const message = `Hello Admin, I am interested in this product:

Product: ${product.name}
Product ID: ${product.id}
Category: ${product.category || 'N/A'}
Style: ${normalizeStyle(product.style || product.cultural_tag)}
Color: ${product.color || 'N/A'}
Size: ${selectedSize}
Quantity: ${quantity}
Price: ${formatPKR(product.price)}

Please share more details.`;

    window.open(
      `https://wa.me/${adminWhatsAppNumber}?text=${encodeURIComponent(message)}`,
      '_blank'
    );
  };

  const incrementQuantity = () => {
    if (quantity < maxQuantity) {
      setQuantity((prev) => prev + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  // Outfit items as flat array for rendering
  const outfitItems = useMemo(() => {
    if (!outfitData?.outfit) return [];

    const items: { label: string; product: ApiProduct }[] = [];
    const outfit = outfitData.outfit;

    if (outfit.shirt) items.push({ label: 'Shirt', product: outfit.shirt });
    if (outfit.pant) items.push({ label: 'Pants', product: outfit.pant });
    if (outfit.shoes) items.push({ label: 'Footwear', product: outfit.shoes });
    if (outfit.accessory) items.push({ label: 'Accessory', product: outfit.accessory });
    if (outfit.coat_or_jacket) items.push({ label: 'Outerwear', product: outfit.coat_or_jacket });

    return items;
  }, [outfitData]);

  const addFullOutfitToCart = () => {
    outfitItems.forEach(({ product: outfitProduct }) => {
      addToCart(toCartProduct(outfitProduct));
    });

    alert(`${outfitItems.length} outfit item(s) added to cart!`);
  };

  // ─── LOADING STATE ────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-cream-base px-6 py-16 flex items-center justify-center">
        <div className="bg-white border border-brand-border/60 rounded-3xl p-8 shadow-sm flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-sage-green animate-spin" />
          <p className="text-sm font-black text-slate-700">
            Loading product details...
          </p>
        </div>
      </div>
    );
  }

  // ─── ERROR STATE ──────────────────────────────────────
  if (errorMessage || !product) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-cream-base px-6 py-16 flex items-center justify-center">
        <div className="max-w-xl w-full bg-white border border-brand-border/60 rounded-3xl p-8 shadow-sm text-center">
          <PackageCheck className="w-14 h-14 text-slate-300 mx-auto mb-4" />

          <h1 className="text-3xl font-black text-brand-dark">
            Product Not Found
          </h1>

          <p className="text-sm text-slate-500 font-semibold mt-3">
            {errorMessage || 'This product is not available.'}
          </p>

          <button
            onClick={() => navigate('/shop')}
            className="mt-6 bg-brand-gold hover:opacity-90 text-white px-6 py-4 rounded-xl text-xs font-black uppercase tracking-wider"
          >
            Back to Shop
          </button>
        </div>
      </div>
    );
  }

  // ─── MAIN PRODUCT DETAIL ─────────────────────────────
  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-cream-base px-6 py-10 text-left font-sans">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate('/shop')}
          className="mb-6 bg-white hover:bg-cream-card/60 border border-brand-border/60 text-slate-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Shop
        </button>

        {/* ─── Product Grid: Image + Details ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-8">

          {/* ═══ LEFT: Product Image with Zoom ═══ */}
          <div className="bg-white border border-brand-border/60 rounded-3xl overflow-hidden shadow-sm">
            <div
              className="aspect-[4/5] bg-cream-card/60 relative group cursor-zoom-in"
              onClick={() => setShowZoom(true)}
            >
              <img
                src={getProductImage(product)}
                alt={product.name}
                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                onError={(event) => {
                  event.currentTarget.src =
                    'https://placehold.co/600x800?text=Wear+Right';
                }}
              />

              {/* Stock Badge */}
              <div
                className={`absolute top-5 left-5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow ${isOutOfStock
                  ? 'bg-red-600 text-white'
                  : Number(product.stock_quantity || 0) <= 5
                    ? 'bg-amber-500 text-white'
                    : 'bg-emerald-600 text-white'
                  }`}
              >
                {isOutOfStock
                  ? 'Out of Stock'
                  : `${product.stock_quantity || 0} Available`}
              </div>

              {/* Zoom Hint */}
              <div className="absolute bottom-5 right-5 bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <ZoomIn className="w-3.5 h-3.5" />
                Click to Zoom
              </div>
            </div>
          </div>

          {/* ═══ RIGHT: Product Info ═══ */}
          <div className="bg-white border border-brand-border/60 rounded-3xl p-6 lg:p-8 shadow-sm">
            <div className="inline-flex items-center gap-2 bg-sage-green/10 text-sage-green px-4 py-2 rounded-full border border-brand-border/40 mb-5">
              <Sparkles className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Product Detail
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-brand-dark tracking-tight">
              {product.name}
            </h1>

            <p className="text-sm text-slate-500 font-semibold mt-4">
              Product ID: WR-{product.id} / {product.category || 'Wear Right Product'}
            </p>

            <div className="flex items-center gap-2 mt-5">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <span className="text-sm font-black text-slate-800">
                Highly Recommended
              </span>
            </div>

            {/* Info Cards */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoCard label="Category" value={product.category || 'N/A'} />
              <InfoCard label="Style" value={normalizeStyle(product.style || product.cultural_tag)} />
              <InfoCard label="Color" value={product.color || 'N/A'} />
              <InfoCard label="Garment Type" value={product.garment_type || 'N/A'} />
              <InfoCard label="Skin Tone" value={product.compatible_skin_tone || 'N/A'} />
              <InfoCard label="Stock" value={`${product.stock_quantity || 0} item(s)`} />
            </div>

            {/* ─── Feature 2: Size Selector ─── */}
            <div className="mt-8">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-3">
                Select Size
              </p>

              <div className="flex flex-wrap gap-2">
                {SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`min-w-[52px] px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider border-2 transition-all duration-200 ${selectedSize === size
                      ? 'bg-slate-950 text-white border-slate-950 shadow-lg shadow-slate-950/20'
                      : 'bg-white text-slate-700 border-brand-border/60 hover:border-slate-400'
                      }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Feature 3: Quantity Selector ─── */}
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black mb-3">
                  Quantity
                </p>

                <div className="inline-flex items-center border-2 border-brand-border/60 rounded-xl overflow-hidden">
                  <button
                    onClick={decrementQuantity}
                    disabled={quantity <= 1}
                    className={`w-12 h-12 flex items-center justify-center transition-colors ${quantity <= 1
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-700 hover:bg-cream-card/60'
                      }`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <div className="w-14 h-12 flex items-center justify-center text-lg font-black text-brand-dark border-x-2 border-brand-border/60">
                    {quantity}
                  </div>

                  <button
                    onClick={incrementQuantity}
                    disabled={quantity >= maxQuantity || isOutOfStock}
                    className={`w-12 h-12 flex items-center justify-center transition-colors ${quantity >= maxQuantity || isOutOfStock
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-700 hover:bg-cream-card/60'
                      }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Price Block */}
              <div className="flex-1 bg-cream-base border border-slate-100 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black block">
                    {quantity > 1 ? 'Total Price' : 'Price'}
                  </span>
                  {quantity > 1 && (
                    <span className="text-xs text-slate-400 font-bold">
                      {formatPKR(product.price)} × {quantity}
                    </span>
                  )}
                </div>

                <span className="text-3xl font-black text-brand-dark">
                  {formatPKR(Number(product.price || 0) * quantity)}
                </span>
              </div>
            </div>

            {/* ─── Action Buttons: Add to Cart, Buy Now, Wishlist, WhatsApp ─── */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Add to Cart */}
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`text-white py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 ${isOutOfStock
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-brand-gold hover:opacity-90 hover:shadow-lg hover:shadow-blue-600/20'
                  }`}
              >
                <ShoppingCart className="w-4 h-4" />
                Add to Cart ({quantity})
              </button>

              {/* Feature 4: Buy Now */}
              <button
                onClick={handleBuyNow}
                disabled={isOutOfStock}
                className={`py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 ${isOutOfStock
                  ? 'bg-slate-300 text-white cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg hover:shadow-emerald-600/20'
                  }`}
              >
                <Zap className="w-4 h-4" />
                Buy Now
              </button>

              {/* Wishlist */}
              <button
                onClick={handleWishlist}
                className={`py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 ${isWishlistActive
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'
                  }`}
              >
                <Heart
                  className={`w-4 h-4 ${isWishlistActive ? 'fill-white' : ''
                    }`}
                />
                {isWishlistActive ? 'Saved' : 'Wishlist'}
              </button>

              {/* WhatsApp */}
              <button
                onClick={openWhatsApp}
                className="bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-lg hover:shadow-green-500/20"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
            </div>

            {/* Why This Product */}
            <div className="mt-8 bg-sage-green/10 border border-brand-border/40 rounded-2xl p-5">
              <h3 className="text-sm font-black text-brand-dark">
                Why this product?
              </h3>

              <p className="text-sm text-slate-600 font-semibold mt-2 leading-relaxed">
                This product is connected with Wear Right recommendation logic. It can be matched with your style preference, skin tone, product category and outfit completion flow.
              </p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* Feature 6: Complete This Outfit Section                */}
        {/* ═══════════════════════════════════════════════════════ */}
        {(outfitLoading || outfitItems.length > 0) && (
          <div className="mt-12">
            <div className="bg-white border border-brand-border/60 rounded-3xl p-6 lg:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full border border-emerald-100 mb-3">
                    <Shirt className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      AI Outfit Matching
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-brand-dark tracking-tight">
                    Complete This Outfit
                  </h2>

                  <p className="text-sm text-slate-500 font-semibold mt-2">
                    Matching items based on style, skin tone compatibility and category.
                  </p>
                </div>

                {outfitItems.length > 0 && (
                  <button
                    onClick={addFullOutfitToCart}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all duration-200 hover:shadow-lg hover:shadow-emerald-600/20 whitespace-nowrap"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Add Full Outfit
                  </button>
                )}
              </div>

              {outfitLoading ? (
                <div className="flex items-center justify-center py-12 gap-3">
                  <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                  <p className="text-sm font-bold text-slate-500">
                    Generating outfit match...
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {outfitItems.map(({ label, product: outfitProduct }) => (
                    <motion.div
                      key={outfitProduct.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="bg-cream-base border border-slate-100 rounded-2xl overflow-hidden group hover:shadow-md hover:border-brand-border/60 transition-all duration-300"
                    >
                      <div
                        className="aspect-square bg-cream-card/60 relative overflow-hidden cursor-pointer"
                        onClick={() => navigate(`/product/${outfitProduct.id}`)}
                      >
                        <img
                          src={getProductImage(outfitProduct)}
                          alt={outfitProduct.name}
                          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110"
                          onError={(event) => {
                            event.currentTarget.src =
                              'https://placehold.co/400x400?text=Wear+Right';
                          }}
                        />

                        <div className="absolute top-2 left-2 bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
                          {label}
                        </div>
                      </div>

                      <div className="p-3">
                        <h4
                          className="text-xs font-black text-brand-dark line-clamp-1 cursor-pointer hover:text-sage-green transition-colors"
                          onClick={() => navigate(`/product/${outfitProduct.id}`)}
                        >
                          {outfitProduct.name}
                        </h4>

                        <p className="text-sm font-black text-slate-700 mt-1">
                          {formatPKR(outfitProduct.price)}
                        </p>

                        <button
                          onClick={() => addToCart(toCartProduct(outfitProduct))}
                          className="w-full mt-2 bg-slate-900 hover:bg-black text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ShoppingCart className="w-3 h-3" />
                          Add
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* Feature 5: You May Also Like                           */}
        {/* ═══════════════════════════════════════════════════════ */}
        {relatedProducts.length > 0 && (
          <div className="mt-12">
            <div className="bg-white border border-brand-border/60 rounded-3xl p-6 lg:p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-full border border-purple-100 mb-3">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Recommendations
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-brand-dark tracking-tight">
                    You May Also Like
                  </h2>

                  <p className="text-sm text-slate-500 font-semibold mt-2">
                    Similar products matching your style and preference.
                  </p>
                </div>

                <button
                  onClick={() => navigate('/shop')}
                  className="hidden sm:flex items-center gap-1 text-xs font-black text-sage-green hover:text-sage-green uppercase tracking-wider transition-colors"
                >
                  View All
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {relatedProducts.map((relProduct) => (
                  <motion.div
                    key={relProduct.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-cream-base border border-slate-100 rounded-2xl overflow-hidden group hover:shadow-md hover:border-brand-border/60 transition-all duration-300"
                  >
                    <div
                      className="aspect-square bg-cream-card/60 relative overflow-hidden cursor-pointer"
                      onClick={() => navigate(`/product/${relProduct.id}`)}
                    >
                      <img
                        src={getProductImage(relProduct)}
                        alt={relProduct.name}
                        className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110"
                        onError={(event) => {
                          event.currentTarget.src =
                            'https://placehold.co/400x400?text=Wear+Right';
                        }}
                      />
                    </div>

                    <div className="p-3">
                      <h4
                        className="text-xs font-black text-brand-dark line-clamp-1 cursor-pointer hover:text-sage-green transition-colors"
                        onClick={() => navigate(`/product/${relProduct.id}`)}
                      >
                        {relProduct.name}
                      </h4>

                      <p className="text-[10px] text-slate-400 font-bold mt-0.5 line-clamp-1">
                        {relProduct.category || 'Wear Right'}
                      </p>

                      <p className="text-sm font-black text-slate-700 mt-1">
                        {formatPKR(relProduct.price)}
                      </p>

                      <button
                        onClick={() => addToCart(toCartProduct(relProduct))}
                        className="w-full mt-2 bg-brand-gold hover:opacity-90 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        Add to Cart
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Mobile view all button */}
              <button
                onClick={() => navigate('/shop')}
                className="sm:hidden w-full mt-4 bg-cream-card/60 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
              >
                View All Products
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Feature 1: Image Zoom Lightbox Modal                   */}
      {/* ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showZoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowZoom(false)}
          >
            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowZoom(false);
              }}
              className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 text-white p-3 rounded-full transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Product name label */}
            <div className="absolute bottom-6 left-6 right-6 text-center">
              <p className="text-white text-sm font-black uppercase tracking-widest truncate bg-black/40 backdrop-blur-sm px-6 py-3 rounded-xl inline-block max-w-lg mx-auto">
                {product.name}
              </p>
            </div>

            {/* Zoomed Image */}
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              src={getProductImage(product)}
              alt={product.name}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onError={(event) => {
                event.currentTarget.src =
                  'https://placehold.co/800x1000?text=Wear+Right';
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-cream-base border border-slate-100 rounded-2xl p-4">
      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
        {label}
      </p>

      <p className="text-sm font-black text-brand-dark mt-2">
        {value}
      </p>
    </div>
  );
}