import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { CartProduct } from "../App";
import { UserState } from "../types";
import {
  getAllowedColorsForProduct,
  isColorAllowed,
  normalizeGarmentType,
  normalizeSkinTone,
  normalizeStyle,
  prettyLabel,
  GarmentKey,
  SkinToneKey,
  StyleKey,
} from "../utils/recommendationRules";
import { API_ENDPOINTS, getProductImageUrl } from "../config/api";

interface CompleteOutfitViewProps {
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

type OutfitProduct = CartProduct & {
  style: string;
  color: string;
  garment_type: string;
  stock_quantity: number;
  status: string;
};

export default function CompleteOutfitView({
  user,
  addToCart,
}: CompleteOutfitViewProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const productId = searchParams.get("productId");
  const skinToneParam = searchParams.get("skinTone");
  const styleParam = searchParams.get("style");

  const detectedSkinTone: SkinToneKey = normalizeSkinTone(
    skinToneParam || user.contrastType || "medium",
  );

  const selectedStyle: StyleKey = normalizeStyle(styleParam || "casual");

  const [products, setProducts] = useState<OutfitProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedShirt, setSelectedShirt] = useState<OutfitProduct | null>(
    null,
  );
  const [selectedPant, setSelectedPant] = useState<OutfitProduct | null>(null);
  const [selectedShoes, setSelectedShoes] = useState<OutfitProduct | null>(
    null,
  );

  const placeholderImage = getProductImageUrl("products/images.jpeg");

  const formatPrice = (price: string | number) => {
    return `Rs. ${Number(price || 0).toLocaleString("en-PK")}`;
  };

  const isOutOfStock = (product: OutfitProduct) => {
    return (
      product.stock_quantity <= 0 ||
      product.status === "Out of Stock" ||
      product.status === "Inactive"
    );
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const response = await fetch(API_ENDPOINTS.products);

      if (!response.ok) {
        throw new Error("Products API response was not successful.");
      }

      const data = await response.json();

      const mappedProducts: OutfitProduct[] = (data.products || []).map(
        (item: ApiProduct) => {
          const normalizedStyle = normalizeStyle(
            item.style || item.cultural_tag || "casual",
          );
          const normalizedGarment = normalizeGarmentType(
            item.garment_type,
            item.category,
          );

          return {
            id: item.id,
            name: item.name,
            category: item.category || "Product",
            style: normalizedStyle,
            color: item.color || "",
            garment_type: normalizedGarment,
            cultural_tag: item.cultural_tag || item.style || normalizedStyle,
            compatible_skin_tone: item.compatible_skin_tone || "",
            image_url: item.image_url || null,
            image: item.image_url
              ? `${item.image_url}?v=${Date.now()}`
              : item.image
                ? `${item.image}?v=${Date.now()}`
                : placeholderImage,
            price: Number(item.price || 0),
            stock_quantity: Number(item.stock_quantity || 0),
            status: item.status || "Active",
          };
        },
      );

      setProducts(mappedProducts);

      const initialProduct = mappedProducts.find(
        (product) => String(product.id) === String(productId),
      );

      if (initialProduct) {
        const garmentType = normalizeGarmentType(
          initialProduct.garment_type,
          initialProduct.category,
        );

        if (garmentType === "shirt") {
          setSelectedShirt(initialProduct);
        } else if (garmentType === "pant") {
          setSelectedPant(initialProduct);
        } else {
          setSelectedShoes(initialProduct);
        }
      }
    } catch (error) {
      console.error("Complete Outfit API Error:", error);
      setErrorMessage("Unable to load outfit products from backend API.");
      console.error("Complete Outfit API Error:", error);
      setErrorMessage("Unable to load outfit products from backend API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [productId]);

  const styleAndSkinToneFilteredProducts = useMemo(() => {
    return products.filter((product) => {
      const productStyle = normalizeStyle(product.style);

      if (productStyle !== selectedStyle) {
        return false;
      }

      const garmentType = normalizeGarmentType(
        product.garment_type,
        product.category,
      );
      const allowedColors = getAllowedColorsForProduct(
        detectedSkinTone,
        selectedStyle,
        garmentType,
      );

      return isColorAllowed(product.color, allowedColors);
    });
  }, [products, detectedSkinTone, selectedStyle]);

  const getSuggestions = (garmentType: GarmentKey) => {
    const allowedColors = getAllowedColorsForProduct(
      detectedSkinTone,
      selectedStyle,
      garmentType,
    );

    return styleAndSkinToneFilteredProducts.filter((product) => {
      const productGarment = normalizeGarmentType(
        product.garment_type,
        product.category,
      );

      if (productGarment !== garmentType) {
        return false;
      }

      if (isOutOfStock(product)) {
        return false;
      }

      if (garmentType === "shoes" && selectedShirt && selectedPant) {
        return isColorAllowed(product.color, allowedColors);
      }

      return isColorAllowed(product.color, allowedColors);
    });
  };

  const shirtSuggestions = getSuggestions("shirt");
  const pantSuggestions = getSuggestions("pant");
  const shoesSuggestions = getSuggestions("shoes");

  const selectedItems = [selectedShirt, selectedPant, selectedShoes].filter(
    Boolean,
  ) as OutfitProduct[];

  const outfitTotal = selectedItems.reduce((total, product) => {
    return total + Number(product.price || 0);
  }, 0);

  const addFullOutfitToCart = () => {
    if (selectedItems.length === 0) {
      alert("Please select at least one outfit item.");
      alert("Please select at least one outfit item.");
      return;
    }

    selectedItems.forEach((product) => {
      addToCart(product);
    });

    alert("Complete outfit added to cart.");
    alert("Complete outfit added to cart.");
  };

  const hasInitialSelection = selectedShirt || selectedPant || selectedShoes;

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-cream-base px-6 py-10 text-left font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="mb-5 bg-white hover:bg-cream-card/60 border border-brand-border/60 text-slate-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <p className="text-[10px] uppercase tracking-widest text-sage-green font-black mb-2">
              Complete the Outfit
            </p>

            <h1 className="text-3xl sm:text-5xl font-black text-brand-dark tracking-tight">
              Smart Matching Outfit
            </h1>

            <p className="text-sm text-slate-500 font-semibold mt-3 max-w-2xl">
              Suggestions stay within same style category and detected skin tone
              allowed colors. Suggestions stay within same style category and
              detected skin tone allowed colors.
            </p>
          </div>

          <div className="bg-white border border-brand-border/60 rounded-2xl p-4 min-w-65">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
              Active Rules
            </p>

            <div className="mt-3 space-y-2">
              <RuleLine
                label="Skin Tone"
                value={prettyLabel(detectedSkinTone)}
              />
              <RuleLine
                label="Skin Tone"
                value={prettyLabel(detectedSkinTone)}
              />
              <RuleLine label="Style" value={prettyLabel(selectedStyle)} />
              <RuleLine label="Total" value={formatPrice(outfitTotal)} />
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
              Loading outfit suggestions...
            </p>
          </div>
        ) : !hasInitialSelection ? (
          <div className="bg-white border border-brand-border/60 rounded-3xl p-12 text-center">
            <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-black text-brand-dark">
              No selected product found
            </h3>
            <p className="text-sm text-slate-500 font-semibold mt-2">
              Recommended Products page se kisi product par Complete Outfit
              click karo. Recommended Products page se kisi product par Complete
              Outfit click karo.
            </p>
            <button
              onClick={() =>
                navigate(`/recommended?skinTone=${detectedSkinTone}`)
              }
              onClick={() =>
                navigate(`/recommended?skinTone=${detectedSkinTone}`)
              }
              className="mt-6 bg-brand-gold hover:opacity-90 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider"
            >
              Go to Recommended Products
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <SelectedSlot
                title="Selected Shirt / Kurta"
                product={selectedShirt}
                placeholderImage={placeholderImage}
                onClear={() => setSelectedShirt(null)}
              />

              <SelectedSlot
                title="Selected Pant / Shalwar"
                product={selectedPant}
                placeholderImage={placeholderImage}
                onClear={() => setSelectedPant(null)}
              />

              <SelectedSlot
                title="Selected Shoes / Sandals"
                product={selectedShoes}
                placeholderImage={placeholderImage}
                onClear={() => setSelectedShoes(null)}
              />
            </div>

            <div className="bg-slate-950 rounded-3xl p-6 text-white shadow-xl mb-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div>
                  <h2 className="text-2xl font-black">Outfit Summary</h2>
                  <h2 className="text-2xl font-black">Outfit Summary</h2>
                  <p className="text-sm text-slate-300 font-semibold mt-2">
                    Select missing items from suggestions and add the full
                    outfit to cart. Select missing items from suggestions and
                    add the full outfit to cart.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={addFullOutfitToCart}
                    className="bg-brand-gold hover:opacity-90 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Add Full Outfit
                  </button>

                  <button
                    onClick={() =>
                      navigate(`/recommended?skinTone=${detectedSkinTone}`)
                    }
                    onClick={() =>
                      navigate(`/recommended?skinTone=${detectedSkinTone}`)
                    }
                    className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Change Item
                  </button>
                </div>
              </div>
            </div>

            {!selectedShirt && (
              <SuggestionSection
                title="Suggested Shirts / Kurtas"
                products={shirtSuggestions}
                placeholderImage={placeholderImage}
                onSelect={setSelectedShirt}
              />
            )}

            {!selectedPant && (
              <SuggestionSection
                title="Suggested Pants / Shalwar"
                products={pantSuggestions}
                placeholderImage={placeholderImage}
                onSelect={setSelectedPant}
              />
            )}

            {!selectedShoes && (
              <SuggestionSection
                title="Suggested Shoes / Sandals"
                products={shoesSuggestions}
                placeholderImage={placeholderImage}
                onSelect={setSelectedShoes}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RuleLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-sm font-black text-brand-dark">{value}</span>
      <span className="text-sm font-black text-brand-dark">{value}</span>
    </div>
  );
}

function SelectedSlot({
  title,
  product,
  placeholderImage,
  onClear,
}: {
  title: string;
  product: OutfitProduct | null;
  placeholderImage: string;
  onClear: () => void;
}) {
  return (
    <div className="bg-white border border-brand-border/60 rounded-3xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-100">
        <h3 className="text-sm font-black text-brand-dark">{title}</h3>
        <h3 className="text-sm font-black text-brand-dark">{title}</h3>
      </div>

      {product ? (
        <>
          <div className="aspect-[4/3] bg-cream-card/60">
            <img
              src={String(product.image || placeholderImage)}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(event) => {
                event.currentTarget.src = placeholderImage;
              }}
            />
          </div>

          <div className="p-5">
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Selected
              </span>
            </div>

            <h4 className="text-sm font-black text-brand-dark">
              {product.name}
            </h4>

            <p className="text-xs text-slate-500 font-bold mt-1">
              Color: {prettyLabel(product.color || "Not Set")}
              Color: {prettyLabel(product.color || "Not Set")}
            </p>

            <p className="text-sm font-black text-brand-dark mt-3">
              Rs. {Number(product.price || 0).toLocaleString("en-PK")}
              Rs. {Number(product.price || 0).toLocaleString("en-PK")}
            </p>

            <button
              onClick={onClear}
              className="mt-4 w-full bg-cream-card/60 hover:bg-slate-200 text-slate-700 rounded-xl py-3 text-xs font-black uppercase tracking-wider"
            >
              Remove
            </button>
          </div>
        </>
      ) : (
        <div className="p-8 text-center">
          <PackageCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-black text-slate-600">Not selected yet</p>
          <p className="text-sm font-black text-slate-600">Not selected yet</p>
        </div>
      )}
    </div>
  );
}

function SuggestionSection({
  title,
  products,
  placeholderImage,
  onSelect,
}: {
  title: string;
  products: OutfitProduct[];
  placeholderImage: string;
  onSelect: (product: OutfitProduct) => void;
}) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-2 mb-5">
        <ShoppingBag className="w-5 h-5 text-sage-green" />
        <h2 className="text-2xl font-black text-brand-dark">{title}</h2>
        <h2 className="text-2xl font-black text-brand-dark">{title}</h2>
      </div>

      {products.length === 0 ? (
        <div className="bg-white border border-brand-border/60 rounded-3xl p-8 text-center">
          <p className="text-sm font-black text-slate-700">
            No matching products available.
          </p>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Admin panel me same style aur matching allowed color ka product add
            karo. Admin panel me same style aur matching allowed color ka
            product add karo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => onSelect(product)}
              className="bg-white border border-brand-border/60 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all text-left"
            >
              <div className="aspect-3/4 bg-cream-card/60">
                <img
                  src={String(product.image || placeholderImage)}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(event) => {
                    event.currentTarget.src = placeholderImage;
                  }}
                />
              </div>

              <div className="p-4">
                <p className="text-[10px] uppercase tracking-widest text-sage-green font-black mb-1">
                  {prettyLabel(product.color || "Not Set")}
                  {prettyLabel(product.color || "Not Set")}
                </p>

                <h3 className="text-sm font-black text-brand-dark line-clamp-1">
                  {product.name}
                </h3>

                <p className="text-xs text-slate-500 font-bold mt-1">
                  {product.category}
                </p>

                <p className="text-sm font-black text-brand-dark mt-3">
                  Rs. {Number(product.price || 0).toLocaleString("en-PK")}
                  Rs. {Number(product.price || 0).toLocaleString("en-PK")}
                </p>

                <span className="mt-4 w-full bg-blue-600 text-white rounded-xl py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2">
                  Select Item
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
