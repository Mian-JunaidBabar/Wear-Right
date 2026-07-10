import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Palette,
  RefreshCw,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';

import { CartProduct } from '../App';
import { UserState } from '../types';
import {
  getAllowedColorsForProduct,
  isColorAllowed,
  normalizeGarmentType,
  normalizeSkinTone,
  normalizeStyle,
  prettyLabel,
  SkinToneKey,
  StyleKey,
} from '../utils/recommendationRules';

interface RecommendedProductsViewProps {
  user: UserState;
  addToCart: (product: CartProduct) => void;
}

type ApiProduct = {
  id: number | string;
  name: string;
  category?: string;
  style?: string;
  cultural_tag?: string;
  color?: string;
  garment_type?: string;
  compatible_skin_tone?: string;
  price: string | number;
  image?: string | null;
  image_url?: string | null;
  stock_quantity?: number;
  status?: string;
};

type RecommendationProduct = CartProduct & {
  style: string;
  color: string;
  garment_type: string;
  stock_quantity: number;
  status: string;
  match: number;
};

const styleOptions: StyleKey[] = ['eastern', 'western', 'casual', 'formal'];

export default function RecommendedProductsView({
  user,
  addToCart,
}: RecommendedProductsViewProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const skinToneFromUrl = searchParams.get('skinTone');
  const skinToneFromUser = user.contrastType;

  const detectedSkinTone: SkinToneKey = normalizeSkinTone(
    skinToneFromUrl || skinToneFromUser || 'medium'
  );

  const [selectedStyle, setSelectedStyle] = useState<StyleKey>('casual');
  const [searchText, setSearchText] = useState('');
  const [products, setProducts] = useState<RecommendationProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const placeholderImage = 'http://127.0.0.1:8000/products/images.jpeg';

  const formatPrice = (price: string | number) => {
    return `Rs. ${Number(price || 0).toLocaleString('en-PK')}`;
  };

  const isOutOfStock = (product: RecommendationProduct) => {
    return (
      product.stock_quantity <= 0 ||
      product.status === 'Out of Stock' ||
      product.status === 'Inactive'
    );
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      const response = await fetch('http://127.0.0.1:8000/api/products/');

      if (!response.ok) {
        throw new Error('Products API response was not successful.');
      }

      const data = await response.json();

      const mappedProducts: RecommendationProduct[] = (data.products || []).map(
        (item: ApiProduct) => {
          const normalizedStyle = normalizeStyle(item.style || item.cultural_tag || 'casual');
          const normalizedGarment = normalizeGarmentType(item.garment_type, item.category);

          return {
            id: item.id,
            name: item.name,
            category: item.category || 'Product',
            style: normalizedStyle,
            color: item.color || '',
            garment_type: normalizedGarment,
            cultural_tag: item.cultural_tag || item.style || normalizedStyle,
            compatible_skin_tone: item.compatible_skin_tone || '',
            image_url: item.image_url || null,
            image: item.image_url
              ? `${item.image_url}?v=${Date.now()}`
              : item.image
                ? `${item.image}?v=${Date.now()}`
                : placeholderImage,
            price: Number(item.price || 0),
            stock_quantity: Number(item.stock_quantity || 0),
            status: item.status || 'Active',
            match: 95,
          };
        }
      );

      setProducts(mappedProducts);
    } catch (error) {
      console.error('Recommended Products API Error:', error);
      setErrorMessage('Unable to load recommended products from backend API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const allowedTopColors = useMemo(() => {
    return getAllowedColorsForProduct(detectedSkinTone, selectedStyle, 'shirt');
  }, [detectedSkinTone, selectedStyle]);

  const allowedPantColors = useMemo(() => {
    return getAllowedColorsForProduct(detectedSkinTone, selectedStyle, 'pant');
  }, [detectedSkinTone, selectedStyle]);

  const allowedShoesColors = useMemo(() => {
    return getAllowedColorsForProduct(detectedSkinTone, selectedStyle, 'shoes');
  }, [detectedSkinTone, selectedStyle]);

  const allAllowedColors = useMemo(() => {
    return Array.from(
      new Set([
        ...allowedTopColors,
        ...allowedPantColors,
        ...allowedShoesColors,
      ])
    );
  }, [allowedTopColors, allowedPantColors, allowedShoesColors]);

  const recommendedProducts = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return products
      .filter((product) => {
        const productStyle = normalizeStyle(product.style);
        const garmentType = normalizeGarmentType(product.garment_type, product.category);

        if (productStyle !== selectedStyle) {
          return false;
        }

        const allowedColors = getAllowedColorsForProduct(
          detectedSkinTone,
          selectedStyle,
          garmentType
        );

        if (!isColorAllowed(product.color, allowedColors)) {
          return false;
        }

        if (search) {
          const combinedText = `${product.name} ${product.category} ${product.style} ${product.color} ${product.garment_type}`.toLowerCase();
          return combinedText.includes(search);
        }

        return true;
      })
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [products, selectedStyle, detectedSkinTone, searchText]);

  const openCompleteOutfit = (product: RecommendationProduct) => {
    navigate(
      `/complete-outfit?skinTone=${detectedSkinTone}&style=${selectedStyle}&productId=${product.id}`
    );
  };

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-cream-base px-6 py-10 text-left font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-950 rounded-3xl p-7 sm:p-10 text-white shadow-xl mb-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-72 h-72 bg-sage-green/100/20 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-sage-green/80 font-black mb-3">
                AI Recommended Products
              </p>

              <h1 className="text-3xl sm:text-5xl font-black tracking-tight">
                Recommended for {prettyLabel(detectedSkinTone)} Skin Tone
              </h1>

              {searchParams.get('confidence') && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold font-sans mt-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  Match Confidence: {searchParams.get('confidence')}%
                </div>
              )}

              <p className="text-sm text-slate-300 font-semibold mt-3 max-w-2xl leading-relaxed">
                Products are filtered using your detected skin tone, selected style category and allowed color palette.
              </p>
            </div>

            <button
              onClick={() => navigate('/facescan')}
              className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Re-Scan
            </button>
          </div>
        </div>

        <div className="bg-white border border-brand-border/60 rounded-3xl p-5 shadow-sm mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <h2 className="text-xl font-black text-brand-dark">
                Select Style Category
              </h2>
              <p className="text-sm text-slate-500 font-semibold mt-1">
                Same style category will be used for Complete Outfit suggestions.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {styleOptions.map((style) => (
                <button
                  key={style}
                  onClick={() => setSelectedStyle(style)}
                  className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    selectedStyle === style
                      ? 'bg-emerald-600 text-white shadow-lg shadow-brand-gold/10'
                      : 'bg-cream-base text-slate-700 border border-brand-border/60 hover:bg-cream-card/60'
                  }`}
                >
                  {prettyLabel(style)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ColorBox title="Top / Shirt / Kurta Colors" colors={allowedTopColors} />
            <ColorBox title="Pant / Shalwar Colors" colors={allowedPantColors} />
            <ColorBox title="Shoes / Sandals Colors" colors={allowedShoesColors} />
          </div>
        </div>

        <div className="bg-white border border-brand-border/60 rounded-3xl p-5 shadow-sm mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div>
              <h2 className="text-xl font-black text-brand-dark">
                Matching Products
              </h2>
              <p className="text-sm text-slate-500 font-semibold mt-1">
                Showing products whose colors match: {allAllowedColors.map(prettyLabel).join(', ')}
              </p>
            </div>

            <div className="relative w-full lg:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search recommended products..."
                className="w-full bg-white border border-brand-border/60 rounded-xl py-3 pl-10 pr-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
              />
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm font-bold mb-8">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-brand-border/60 rounded-3xl p-12 text-center">
            <p className="text-sm font-black text-slate-700">
              Loading recommended products...
            </p>
          </div>
        ) : recommendedProducts.length === 0 ? (
          <div className="bg-white border border-brand-border/60 rounded-3xl p-12 text-center">
            <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-black text-brand-dark">
              No recommended products found
            </h3>
            <p className="text-sm text-slate-500 font-semibold mt-2 max-w-xl mx-auto">
              Admin panel me selected skin tone, style aur allowed colors ke products add karo. Product color field exact allowed color list se match honi chahiye.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {recommendedProducts.map((product) => (
              <article
                key={product.id}
                className={`bg-white border border-brand-border/60 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all ${
                  isOutOfStock(product) ? 'opacity-70' : ''
                }`}
              >
                <div className="aspect-[3/4] bg-cream-card/60 relative overflow-hidden">
                  <img
                    src={String(product.image || placeholderImage)}
                    alt={product.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                    onError={(event) => {
                      event.currentTarget.src = placeholderImage;
                    }}
                  />

                  <div className="absolute top-3 left-3 bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Recommended
                  </div>

                  <div
                    className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      isOutOfStock(product)
                        ? 'bg-red-600 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {isOutOfStock(product) ? 'Out of Stock' : `${product.stock_quantity} Stock`}
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-widest text-sage-green font-black">
                      {prettyLabel(product.style)}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                      {prettyLabel(product.garment_type)}
                    </span>
                  </div>

                  <h3 className="text-sm font-black text-brand-dark line-clamp-1">
                    {product.name}
                  </h3>

                  <p className="text-xs text-slate-500 font-bold mt-1">
                    {product.category}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs font-black text-slate-500">
                      Color
                    </span>
                    <span className="text-xs font-black text-brand-dark">
                      {prettyLabel(product.color || 'Not Set')}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-xs font-black text-slate-500">
                      Price
                    </span>
                    <span className="text-sm font-black text-brand-dark">
                      {formatPrice(product.price)}
                    </span>
                  </div>

                  <div className="mt-5 space-y-2">
                    <button
                      onClick={() => addToCart(product)}
                      disabled={isOutOfStock(product)}
                      className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 ${
                        isOutOfStock(product)
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-brand-gold hover:opacity-90 text-white shadow-lg shadow-brand-gold/10'
                      }`}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add to Cart
                    </button>

                    <button
                      onClick={() => openCompleteOutfit(product)}
                      className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 bg-slate-950 hover:bg-black text-white"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Complete Outfit
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ColorBox({ title, colors }: { title: string; colors: string[] }) {
  return (
    <div className="bg-cream-base border border-slate-100 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Palette className="w-4 h-4 text-sage-green" />
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">
          {title}
        </h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <span
            key={`${title}-${color}`}
            className="bg-white border border-brand-border/60 text-slate-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider"
          >
            {prettyLabel(color)}
          </span>
        ))}
      </div>
    </div>
  );
}