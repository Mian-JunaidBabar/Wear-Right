"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "@/lib/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  ShoppingBag,
  ShoppingCart,
  MessageCircle,
  Eye,
  X,
  Star,
  Shirt,
  ArrowLeft,
  Search,
  Zap,
  Heart,
} from "lucide-react";
import { Product } from "@/lib/types";
import { } from "@/features/cart/types";
import { ADMIN_WHATSAPP_NUMBER, PLACEHOLDER_IMAGE } from "@/lib/config";
import { notify } from "@/lib/notify";
import { useAuth } from "@/features/auth/AuthProvider";
import { useCart } from "@/features/cart/useCart";
import { useWishlist } from "@/features/wishlist/useWishlist";
import { catalogApi } from "@/features/catalog/api";
import { ordersApi, orderErrorMessage } from "@/features/orders/api";

interface ApiProduct {
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
}

type ShopProduct = Product & {
  category: string;
  stock_quantity: number;
  status: string;
  color?: string;
  garment_type?: string;
  cultural_tag?: string;
  compatible_skin_tone?: string;
  image_url?: string | null;
};

type OutfitItem = {
  name?: string;
  image_url?: string | null;
  image?: string | null;
};

type GeneratedOutfit = {
  main_item?: OutfitItem;
  outfit?: {
    shirt?: OutfitItem | null;
    pant?: OutfitItem | null;
    pants_or_jeans?: OutfitItem | null;
    shoes?: OutfitItem | null;
    accessory?: OutfitItem | null;
    coat_or_jacket?: OutfitItem | null;
  };
};

type GenderType = "Men" | "Women";

type ShopCategoryItem = {
  label: string;
  value: string;
  image: string;
};

const categoryGroups: Record<GenderType, ShopCategoryItem[]> = {
  Men: [
    {
      label: "Men Shirt",
      value: "Men Shirt",
      image: "/category-images/men-shirt.jpg",
    },
    {
      label: "Men Pant",
      value: "Men Pant",
      image: "/category-images/men-pant.jpg",
    },
    {
      label: "Men Shoes",
      value: "Men Shoes",
      image: "/category-images/men-shoes.jpg",
    },
    {
      label: "Men Cap",
      value: "Men Cap",
      image: "/category-images/men-cap.jpg",
    },
    {
      label: "Men Shalwar Kameez",
      value: "Men Shalwar Kameez",
      image: "/category-images/men-shalwar-kameez.jpg",
    },
    {
      label: "Men Sandals",
      value: "Men Sandals",
      image: "/category-images/men-sandals.jpg",
    },
  ],
  Women: [
    {
      label: "Women Kurta",
      value: "Women Kurta",
      image: "/category-images/women-kurta.jpg",
    },
    {
      label: "Women Shalwar Kameez",
      value: "Women Shalwar Kameez",
      image: "/category-images/women-shalwar-kameez.jpg",
    },
    {
      label: "Women Footwear",
      value: "Women Footwear",
      image: "/category-images/women-footwear.jpg",
    },
    {
      label: "Women Pant",
      value: "Women Pant",
      image: "/category-images/women-pant.jpg",
    },
    {
      label: "Women Shirt",
      value: "Women Shirt",
      image: "/category-images/women-shirt.jpg",
    },
  ],
};

const allCategoryItems = [...categoryGroups.Men, ...categoryGroups.Women];

const getCategoryPlaceholder = (category: string) => {
  return `https://placehold.co/900x550/eef2ff/1e293b?text=${encodeURIComponent(category)}`;
};

export default function ShopView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { wishlistItems, toggleWishlist } = useWishlist();
  const [searchParams] = useSearchParams();

  const genderParam = searchParams.get("gender") as GenderType | null;
  const [selectedGender, setSelectedGender] = useState<GenderType>(
    genderParam === "Men" || genderParam === "Women" ? genderParam : "Men",
  );

  // A new ?gender= (e.g. from the footer) switches the collection. This adjusts state
  // while rendering, the React-recommended alternative to setting state in an effect.
  const [seenGenderParam, setSeenGenderParam] = useState(genderParam);
  if (genderParam !== seenGenderParam) {
    setSeenGenderParam(genderParam);
    if (genderParam === "Men" || genderParam === "Women") {
      setSelectedGender(genderParam);
    }
  }
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const [categorySort, setCategorySort] = useState<
    "newest" | "match" | "priceAsc" | "priceDesc"
  >("newest");
  const [selectedCultureStyle, setSelectedCultureStyle] = useState<
    "All" | "Eastern" | "Western" | "Casual" | "Formal"
  >("All");
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(
    null,
  );

  const [apiProducts, setApiProducts] = useState<ShopProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productError, setProductError] = useState("");

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generatedOutfit, setGeneratedOutfit] =
    useState<GeneratedOutfit | null>(null);

  const [orderForm, setOrderForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    customer_address: "",
    quantity: "1",
    payment_status: "Cash on Delivery",
  });

  const placeholderImage = PLACEHOLDER_IMAGE;

  const normalizeCategory = (category?: string) => {
    if (!category) return "Men Shirt";

    const legacyCategoryMap: Record<string, string> = {
      Shirt: "Men Shirt",
      Pant: "Men Pant",
      Pants: "Men Pant",
      Shoes: "Men Shoes",
      Cap: "Men Cap",
      "Shalwar Kameez": "Men Shalwar Kameez",
      Sandals: "Men Sandals",
      Chappals: "Men Sandals",
      Accessory: "Men Cap",
      Accessories: "Men Cap",
      Waistcoat: "Men Shalwar Kameez",
      "Waist Coat": "Men Shalwar Kameez",
      Kurta: "Women Kurta",
      Kurtas: "Women Kurta",
      "Women Shalwar Kameez": "Women Shalwar Kameez",
      "Women Footwear": "Women Footwear",
      "Women Pant": "Women Pant",
      "Women Shirt": "Women Shirt",
    };

    if (legacyCategoryMap[category]) {
      return legacyCategoryMap[category];
    }

    return category;
  };

  const normalizeStyle = (style?: string) => {
    if (!style) return "Casual";
    const value = style.toLowerCase();

    if (value.includes("eastern")) return "Eastern";
    if (value.includes("western")) return "Western";
    if (value.includes("formal")) return "Formal";
    if (value.includes("casual")) return "Casual";

    return "Casual";
  };

  const getProductImage = (item: ApiProduct) => {
    const image = item.image_url || item.image || placeholderImage;

    if (image.includes("?")) {
      return `${image}&v=${Date.now()}`;
    }

    return `${image}?v=${Date.now()}`;
  };

  const isOutOfStock = (product: ShopProduct) => {
    return (
      product.stock_quantity <= 0 ||
      product.status === "Out of Stock" ||
      product.status === "Inactive"
    );
  };

  const isWishlistActive = (productId: number | string) => {
    return wishlistItems.some((item) => String(item.id) === String(productId));
  };

  const loadProducts = async () => {
    try {
      const data = await catalogApi.products<ApiProduct>();

      const mappedProducts: ShopProduct[] = (data.products || []).map(
        (item) => {
          const normalizedStyle = normalizeStyle(
            item.style || item.cultural_tag,
          );
          const normalizedCategory = normalizeCategory(item.category);
          const productColor =
            item.color || item.compatible_skin_tone || "Medium";

          return {
            id: String(item.id),
            name: item.name,
            price: Number(item.price),
            image: getProductImage(item),
            image_url: item.image_url || item.image || null,
            match: 95,
            style: normalizedStyle as Product["style"],
            colors: [productColor],
            category: normalizedCategory,
            color: item.color || "",
            garment_type: item.garment_type || "",
            cultural_tag: item.cultural_tag || normalizedStyle,
            compatible_skin_tone: item.compatible_skin_tone || "",
            stock_quantity: Number(item.stock_quantity || 0),
            status: item.status || "Active",
          };
        },
      );

      setApiProducts(mappedProducts);
    } catch (error) {
      console.error("Product API Error:", error);
      setProductError("Unable to load products from backend API.");
    } finally {
      setLoadingProducts(false);
    }
  };

  const refreshProducts = async () => {
    setLoadingProducts(true);
    setProductError("");
    await loadProducts();
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: state is set after the request resolves
    void loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const getCategoryProducts = (category: string) => {
    return apiProducts.filter((product) => product.category === category);
  };

  const getCategoryImage = (categoryItem: ShopCategoryItem) => {
    return categoryItem.image;
  };

  const getActiveCategoryItem = () => {
    return allCategoryItems.find((item) => item.value === activeCategory);
  };

  const getActiveCategoryTitle = () => {
    return getActiveCategoryItem()?.label || activeCategory || "Category";
  };

  const getActiveCategoryImage = () => {
    const activeItem = getActiveCategoryItem();

    if (!activeItem) {
      return getCategoryPlaceholder(activeCategory || "Category");
    }

    return activeItem.image;
  };

  const openCategoryPage = (category: string) => {
    setActiveCategory(category);
    setCategorySearch("");
    setCategorySort("newest");
    setSelectedCultureStyle("All");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const backToCategories = () => {
    setActiveCategory(null);
    setCategorySearch("");
    setCategorySort("newest");
    setSelectedCultureStyle("All");
  };

  const filteredProducts = useMemo(() => {
    let result = activeCategory
      ? apiProducts.filter((product) => product.category === activeCategory)
      : [];

    const searchText = categorySearch.toLowerCase().trim();

    if (searchText) {
      result = result.filter(
        (product) =>
          product.name.toLowerCase().includes(searchText) ||
          product.category.toLowerCase().includes(searchText) ||
          product.style.toLowerCase().includes(searchText) ||
          product.colors.join(" ").toLowerCase().includes(searchText) ||
          String(product.color || "")
            .toLowerCase()
            .includes(searchText) ||
          String(product.garment_type || "")
            .toLowerCase()
            .includes(searchText),
      );
    }

    if (selectedCultureStyle !== "All") {
      result = result.filter(
        (product) => product.style === selectedCultureStyle,
      );
    }

    if (categorySort === "newest") {
      result.sort((a, b) => Number(b.id) - Number(a.id));
    } else if (categorySort === "match") {
      result.sort((a, b) => b.match - a.match);
    } else if (categorySort === "priceAsc") {
      result.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (categorySort === "priceDesc") {
      result.sort((a, b) => Number(b.price) - Number(a.price));
    }

    return result;
  }, [
    apiProducts,
    activeCategory,
    categorySearch,
    categorySort,
    selectedCultureStyle,
  ]);

  const openPreviewModal = async (product: ShopProduct) => {
    try {
      setSelectedProduct(product);
      setPreviewLoading(true);
      setGeneratedOutfit(null);
      setIsPreviewModalOpen(true);

      const data = await catalogApi.outfit<GeneratedOutfit>(product.id);
      setGeneratedOutfit(data);
    } catch (error) {
      console.error("Preview API Error:", error);
      alert("Unable to load mannequin preview from backend API.");
      setIsPreviewModalOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const formatPrice = (price: number | string) => {
    return `Rs. ${Number(price || 0).toLocaleString("en-PK")}`;
  };

  const openProductWhatsApp = (product: ShopProduct) => {
    const adminWhatsAppNumber = ADMIN_WHATSAPP_NUMBER;

    const message = `Hello Admin, I am interested in this product:

Product: ${product.name}
Category: ${product.category}
Style: ${product.style}
Color: ${product.color || product.colors.join(", ")}
Price: ${formatPrice(product.price)}

Please share more details.`;

    window.open(
      `https://wa.me/${adminWhatsAppNumber}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };

  // Orders belong to an account, so guests sign in first and come back to the shop.
  const requireLoginToOrder = () => {
    if (user.isLoggedIn) return true;
    notify("Please log in to place an order.");
    navigate(`/login?next=${encodeURIComponent("/shop")}`);
    return false;
  };

  const openOrderModal = () => {
    if (!requireLoginToOrder()) return;

    if (!selectedProduct) {
      alert("Product is not selected.");
      return;
    }

    if (isOutOfStock(selectedProduct)) {
      alert("This product is currently out of stock.");
      return;
    }

    setOrderForm({
      customer_name: "",
      customer_email: "",
      customer_phone: "",
      customer_address: "",
      quantity: "1",
      payment_status: "Cash on Delivery",
    });

    setIsOrderModalOpen(true);
  };

  const handleAddToCart = (product: ShopProduct) => {
    if (isOutOfStock(product)) {
      alert("This product is currently out of stock.");
      return;
    }

    addToCart(product);
  };

  const handleBuyNow = (product: ShopProduct) => {
    if (!requireLoginToOrder()) return;

    if (isOutOfStock(product)) {
      alert("This product is currently out of stock.");
      return;
    }

    setSelectedProduct(product);
    addToCart(product);

    setOrderForm({
      customer_name: "",
      customer_email: "",
      customer_phone: "",
      customer_address: "",
      quantity: "1",
      payment_status: "Cash on Delivery",
    });

    setIsOrderModalOpen(true);
  };

  const closeOrderModal = () => {
    setIsOrderModalOpen(false);
  };

  const handleWishlistClick = (
    event: React.MouseEvent,
    product: ShopProduct,
  ) => {
    event.stopPropagation();

    toggleWishlist(product);
  };

  const openProductDetail = (product: ShopProduct) => {
    navigate(`/product/${product.id}`);
  };

  const openQuickView = (event: React.MouseEvent, product: ShopProduct) => {
    event.stopPropagation();
    setSelectedProduct(product);
  };

  const submitOrder = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedProduct) {
      alert("Product is not selected.");
      return;
    }

    const requestedQuantity = Number(orderForm.quantity || 1);

    if (
      !orderForm.customer_name ||
      !orderForm.customer_phone ||
      !orderForm.customer_address
    ) {
      alert("Name, phone and address are required.");
      return;
    }

    if (requestedQuantity <= 0) {
      alert("Quantity must be 1 or greater.");
      return;
    }

    if (requestedQuantity > selectedProduct.stock_quantity) {
      alert(
        `Only ${selectedProduct.stock_quantity} item(s) available in stock.`,
      );
      return;
    }

    if (isOutOfStock(selectedProduct)) {
      alert("This product is currently out of stock.");
      return;
    }

    try {
      setOrderSubmitting(true);

      await ordersApi.create({
        customer_name: orderForm.customer_name,
        customer_email: orderForm.customer_email,
        customer_phone: orderForm.customer_phone,
        customer_address: orderForm.customer_address,
        product: Number(selectedProduct.id),
        quantity: requestedQuantity,
        order_status: "Pending",
        payment_status: orderForm.payment_status,
      });

      alert("Order placed successfully. Admin panel will show this order.");

      setIsOrderModalOpen(false);
      setIsPreviewModalOpen(false);
      setSelectedProduct(null);
      await refreshProducts();
    } catch (error) {
      console.error("Order API Error:", error);
      alert(orderErrorMessage(error));
    } finally {
      setOrderSubmitting(false);
    }
  };

  const getOutfitImage = (
    item?: { image_url?: string | null; image?: string | null } | null,
  ) => {
    if (!item) return placeholderImage;
    return item.image_url || item.image || placeholderImage;
  };

  const visibleCategories = categoryGroups[selectedGender];

  return (
    <div className="w-full bg-cream-base pb-24 text-left font-sans flex flex-col items-center">
      <div className="max-w-7xl mx-auto px-6 py-12 w-full">
        {!activeCategory ? (
          <section className="w-full">
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-display font-black text-brand-dark tracking-tight">
                Shop by Category
              </h1>
              <p className="text-sm text-slate-500 font-semibold mt-3">
                Select men or women collection and browse fashion categories.
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 mb-10">
              <button
                onClick={() => setSelectedGender("Men")}
                className={`px-10 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-lg ${
                  selectedGender === "Men"
                    ? "bg-blue-600 text-white shadow-brand-gold/10"
                    : "bg-white text-slate-700 border border-brand-border/60 hover:bg-cream-base"
                }`}
              >
                Men
              </button>

              <button
                onClick={() => setSelectedGender("Women")}
                className={`px-10 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-lg ${
                  selectedGender === "Women"
                    ? "bg-pink-600 text-white shadow-pink-100"
                    : "bg-white text-slate-700 border border-brand-border/60 hover:bg-cream-base"
                }`}
              >
                Women
              </button>
            </div>

            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border/60 pb-4">
              <div>
                <h2 className="text-3xl font-black text-brand-dark">
                  {selectedGender === "Men"
                    ? "Men Collection"
                    : "Women Collection"}
                </h2>
                <p className="text-sm text-slate-500 font-semibold mt-1">
                  {selectedGender === "Men"
                    ? "Explore shirts, pants, shoes, caps, shalwar kameez and sandals."
                    : "Explore kurta, shalwar kameez, footwear, pants and shirts."}
                </p>
              </div>

              <span
                className={`inline-flex w-fit px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider ${
                  selectedGender === "Men"
                    ? "bg-sage-green/10 text-sage-green"
                    : "bg-pink-50 text-pink-700"
                }`}
              >
                {selectedGender}
              </span>
            </div>

            {productError && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs font-bold">
                {productError}
              </div>
            )}

            {loadingProducts ? (
              <div className="py-20 text-center bg-white border border-brand-border/60 rounded-2xl p-6 w-full shadow-sm">
                <p className="text-sm font-semibold text-slate-800">
                  Loading categories from Django API...
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
                {visibleCategories.map((categoryItem) => {
                  const count = getCategoryProducts(categoryItem.value).length;
                  const image = getCategoryImage(categoryItem);

                  return (
                    <button
                      key={categoryItem.value}
                      onClick={() => openCategoryPage(categoryItem.value)}
                      className={`bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all text-left group ${
                        selectedGender === "Men"
                          ? "border-brand-border/60 hover:border-brand-border/60"
                          : "border-brand-border/60 hover:border-pink-200"
                      }`}
                    >
                      <div className="aspect-[16/10] bg-cream-card/60 overflow-hidden relative">
                        <img
                          src={image}
                          alt={categoryItem.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          onError={(event) => {
                            event.currentTarget.src = getCategoryPlaceholder(
                              categoryItem.label,
                            );
                          }}
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent" />

                        <div className="absolute top-4 right-4 bg-white/95 text-brand-dark px-3 py-1 rounded-full text-xs font-black shadow">
                          {count} {count === 1 ? "product" : "products"}
                        </div>
                      </div>

                      <div className="p-5 text-center">
                        <h2
                          className={`text-lg font-black text-brand-dark transition-colors ${
                            selectedGender === "Men"
                              ? "group-hover:text-sage-green"
                              : "group-hover:text-pink-600"
                          }`}
                        >
                          {categoryItem.label}
                        </h2>
                        <p className="text-xs text-slate-500 font-semibold mt-1">
                          View {categoryItem.label} collection
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section className="w-full text-left">
            <div className="mb-8 rounded-3xl overflow-hidden bg-slate-950 relative min-h-[240px] flex items-center justify-center text-center">
              <img
                src={getActiveCategoryImage()}
                alt={getActiveCategoryTitle()}
                className="absolute inset-0 w-full h-full object-cover opacity-35"
                onError={(event) => {
                  event.currentTarget.src = getCategoryPlaceholder(
                    getActiveCategoryTitle(),
                  );
                }}
              />

              <div className="relative z-10 p-8">
                <button
                  onClick={backToCategories}
                  className="mx-auto mb-5 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Categories
                </button>

                <h1 className="text-4xl sm:text-5xl font-black text-white">
                  {getActiveCategoryTitle()}
                </h1>
                <p className="text-slate-200 text-sm font-semibold mt-3">
                  Showing {filteredProducts.length} products
                </p>
              </div>
            </div>

            <div className="mb-8 bg-white border border-brand-border/60 rounded-2xl shadow-sm p-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-brand-dark">
                    Choose Style Preference
                  </h3>
                  <p className="text-sm text-slate-500 font-semibold mt-1">
                    Select your preferred fashion style for this category.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {(
                    ["All", "Eastern", "Western", "Casual", "Formal"] as const
                  ).map((styleOption) => (
                    <button
                      key={styleOption}
                      onClick={() => setSelectedCultureStyle(styleOption)}
                      className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                        selectedCultureStyle === styleOption
                          ? "bg-blue-600 text-white shadow-lg shadow-brand-gold/10"
                          : "bg-cream-base text-slate-700 border border-brand-border/60 hover:bg-cream-card/60"
                      }`}
                    >
                      {styleOption}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-8 bg-white border border-brand-border/60 rounded-2xl shadow-sm p-5">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-red-600 uppercase tracking-tight">
                    Search & Filter
                  </h3>
                  <p className="text-sm text-slate-500 font-semibold mt-1">
                    Find exactly what you are looking for.
                  </p>
                  <p className="text-sm text-slate-700 font-bold mt-6">
                    Showing {filteredProducts.length} products
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

                    <input
                      value={categorySearch}
                      onChange={(event) =>
                        setCategorySearch(event.target.value)
                      }
                      placeholder="Search products..."
                      className="w-full bg-white border border-brand-border/60 rounded-xl py-3 pl-10 pr-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                    />
                  </div>

                  <select
                    value={categorySort}
                    onChange={(event) =>
                      setCategorySort(
                        event.target.value as
                          | "newest"
                          | "match"
                          | "priceAsc"
                          | "priceDesc",
                      )
                    }
                    className="bg-white border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                  >
                    <option value="newest">Newest Arrivals</option>
                    <option value="match">Matching Level</option>
                    <option value="priceAsc">Price: Low to High</option>
                    <option value="priceDesc">Price: High to Low</option>
                  </select>
                </div>
              </div>
            </div>

            <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8 pb-4 border-b border-brand-border/60">
              <div>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-brand-dark tracking-tight">
                  Fresh Arrivals & Restocked
                </h2>
                <p className="text-xs text-slate-500 font-sans mt-1 font-semibold">
                  Products from {getActiveCategoryTitle()} category.
                </p>
              </div>

              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {categorySort === "newest"
                  ? "Newest Arrivals"
                  : categorySort === "match"
                    ? "Matching Level"
                    : categorySort === "priceAsc"
                      ? "Price: Low to High"
                      : "Price: High to Low"}
              </p>
            </header>

            {filteredProducts.length === 0 ? (
              <div className="py-20 text-center bg-white border border-brand-border/60 rounded-2xl p-6 w-full shadow-sm">
                <span className="text-3xl font-bold text-slate-300 block mb-3">
                  ∅
                </span>
                <p className="text-sm font-semibold text-slate-800">
                  No products found in {getActiveCategoryTitle()}.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Clear search or add products from admin panel.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map((prod) => (
                  <article
                    key={prod.id}
                    onClick={() => openProductDetail(prod)}
                    className={`bg-white rounded-2xl border border-brand-border/60 hover:shadow-xl hover:border-slate-300 transition-all duration-300 cursor-pointer overflow-hidden group flex flex-col justify-between shadow-sm ${
                      isOutOfStock(prod) ? "opacity-70" : ""
                    }`}
                  >
                    <div className="aspect-[3/4] bg-cream-base relative overflow-hidden flex-shrink-0">
                      <img
                        src={prod.image}
                        alt={prod.name}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-in-out"
                        referrerPolicy="no-referrer"
                        onError={(event) => {
                          event.currentTarget.src = placeholderImage;
                        }}
                      />

                      <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-sm border border-slate-750 text-emerald-400 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide flex items-center gap-1 z-10 shadow-sm">
                        <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                        <span className="text-white font-mono">
                          {prod.match}% MATCH
                        </span>
                      </div>

                      <div
                        className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-black z-10 shadow-sm ${
                          isOutOfStock(prod)
                            ? "bg-red-600 text-white"
                            : prod.stock_quantity <= 5
                              ? "bg-amber-500 text-white"
                              : "bg-emerald-600 text-white"
                        }`}
                      >
                        {isOutOfStock(prod)
                          ? "OUT OF STOCK"
                          : `${prod.stock_quantity} AVAILABLE`}
                      </div>

                      <button
                        onClick={(event) => handleWishlistClick(event, prod)}
                        className={`absolute bottom-3 right-3 w-11 h-11 rounded-full shadow-lg flex items-center justify-center z-20 transition-all ${
                          isWishlistActive(prod.id)
                            ? "bg-red-600 text-white"
                            : "bg-white text-slate-700 hover:bg-red-50 hover:text-red-600"
                        }`}
                        title="Wishlist"
                      >
                        <Heart
                          className={`w-5 h-5 ${
                            isWishlistActive(prod.id) ? "fill-white" : ""
                          }`}
                        />
                      </button>

                      <button
                        onClick={(event) => openQuickView(event, prod)}
                        className="absolute bottom-3 left-3 bg-white/95 text-brand-dark text-[10px] font-bold uppercase tracking-widest px-4 py-3 shadow-md rounded-xl border border-brand-border/60 flex items-center gap-1.5 z-20 hover:bg-blue-600 hover:text-white transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Quick View
                      </button>
                    </div>

                    <div className="p-4 flex flex-col justify-between flex-1">
                      <div>
                        <div className="flex items-center justify-between gap-1.5 text-[10px] uppercase text-slate-400 font-extrabold font-sans mb-1">
                          <span>{prod.style}</span>
                          <span>{prod.color || prod.colors.join(", ")}</span>
                        </div>

                        <h3 className="text-xs uppercase font-extrabold tracking-wider text-brand-dark line-clamp-1">
                          {prod.name}
                        </h3>

                        <p className="text-[10px] text-slate-400 font-black mt-1 uppercase tracking-wider">
                          {prod.garment_type || prod.category}
                        </p>
                      </div>

                      <div className="mt-3 space-y-3">
                        <p className="text-xs font-bold text-slate-500 font-mono">
                          {formatPrice(prod.price)}
                        </p>

                        <p
                          className={`text-[10px] font-black ${
                            isOutOfStock(prod)
                              ? "text-red-600"
                              : prod.stock_quantity <= 5
                                ? "text-amber-600"
                                : "text-emerald-600"
                          }`}
                        >
                          {isOutOfStock(prod)
                            ? "Currently unavailable"
                            : `Available Stock: ${prod.stock_quantity} item(s)`}
                        </p>

                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleAddToCart(prod);
                          }}
                          disabled={isOutOfStock(prod)}
                          className={`w-full text-white text-xs font-black uppercase tracking-wider py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                            isOutOfStock(prod)
                              ? "bg-slate-300 cursor-not-allowed"
                              : "bg-brand-gold hover:opacity-90 shadow-md shadow-brand-gold/10"
                          }`}
                        >
                          <ShoppingCart className="w-4 h-4" />
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white max-w-5xl w-full rounded-2xl shadow-2xl overflow-hidden border border-brand-border/60 relative text-left"
            >
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 bg-cream-card/60 hover:bg-slate-200 text-slate-600 rounded-full p-1.5 transition-colors focus:outline-none z-10 shadow cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-[45%_55%]">
                <div className="h-[520px] bg-cream-base relative overflow-hidden">
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    className="w-full h-full object-contain bg-cream-card/60"
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.src = placeholderImage;
                    }}
                  />

                  <div className="absolute top-4 left-4 bg-slate-900/95 text-sage-green border border-slate-800 font-mono text-xs px-2.5 py-1.5 font-bold rounded-lg shadow-md">
                    {selectedProduct.match}% match rate
                  </div>

                  <div
                    className={`absolute top-4 right-4 px-3 py-1.5 rounded-lg text-[10px] font-black shadow ${
                      isOutOfStock(selectedProduct)
                        ? "bg-red-600 text-white"
                        : selectedProduct.stock_quantity <= 5
                          ? "bg-amber-500 text-white"
                          : "bg-emerald-600 text-white"
                    }`}
                  >
                    {isOutOfStock(selectedProduct)
                      ? "OUT OF STOCK"
                      : `${selectedProduct.stock_quantity} AVAILABLE`}
                  </div>
                </div>

                <div className="p-6 lg:p-8 flex flex-col justify-between min-w-0">
                  <div>
                    <span className="text-[10px] uppercase text-sage-green font-extrabold tracking-widest font-sans">
                      Backend Catalog Product
                    </span>

                    <h2 className="text-xl font-display font-bold text-brand-dark mt-2 mb-1 leading-tight">
                      {selectedProduct.name}
                    </h2>

                    <p className="text-slate-400 text-xs font-sans mb-4 uppercase tracking-wider font-extrabold">
                      ID: {selectedProduct.id} / {selectedProduct.style} /{" "}
                      {selectedProduct.category}
                    </p>

                    <div className="h-px bg-cream-card/60 w-full mb-4" />

                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <InfoBox
                        label="Color"
                        value={
                          selectedProduct.color ||
                          selectedProduct.colors.join(", ")
                        }
                      />
                      <InfoBox
                        label="Garment Type"
                        value={selectedProduct.garment_type || "N/A"}
                      />
                      <InfoBox
                        label="Skin Tone"
                        value={selectedProduct.compatible_skin_tone || "N/A"}
                      />
                      <InfoBox label="Status" value={selectedProduct.status} />
                    </div>

                    <div className="space-y-3.5 text-xs text-slate-500 font-sans font-semibold leading-relaxed">
                      <p>
                        This product is loaded from Django REST API. Category is
                        selected from admin panel and automatically shown on
                        shop page.
                      </p>

                      <p>
                        Use preview before order to see how this outfit
                        combination may look.
                      </p>

                      <div className="flex items-center gap-1.5 mt-2">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span className="font-bold text-slate-800">
                          Highly Recommended
                        </span>
                      </div>

                      <div
                        className={`p-3 rounded-xl border ${
                          isOutOfStock(selectedProduct)
                            ? "bg-red-50 border-red-100 text-red-700"
                            : selectedProduct.stock_quantity <= 5
                              ? "bg-amber-50 border-amber-100 text-amber-700"
                              : "bg-emerald-50 border-emerald-100 text-emerald-700"
                        }`}
                      >
                        <p className="font-black">
                          {isOutOfStock(selectedProduct)
                            ? "This product is currently unavailable."
                            : `Available Stock: ${selectedProduct.stock_quantity} item(s)`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                    <div className="flex justify-between items-baseline mb-4">
                      <span className="text-xs text-slate-400 font-sans font-bold">
                        Retail price
                      </span>
                      <span className="text-xl font-bold font-mono text-brand-dark">
                        {formatPrice(selectedProduct.price)}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                          onClick={() => handleAddToCart(selectedProduct)}
                          disabled={isOutOfStock(selectedProduct)}
                          className={`text-white text-xs font-black uppercase tracking-wider py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md ${
                            isOutOfStock(selectedProduct)
                              ? "bg-slate-300 cursor-not-allowed"
                              : "bg-red-600 hover:bg-red-700 cursor-pointer shadow-red-100"
                          }`}
                        >
                          <ShoppingCart className="w-4 h-4" />
                          Add to Cart
                        </button>

                        <button
                          onClick={() => handleBuyNow(selectedProduct)}
                          disabled={isOutOfStock(selectedProduct)}
                          className={`text-white text-xs font-black uppercase tracking-wider py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md ${
                            isOutOfStock(selectedProduct)
                              ? "bg-slate-300 cursor-not-allowed"
                              : "bg-slate-900 hover:bg-black cursor-pointer shadow-slate-100"
                          }`}
                        >
                          <Zap className="w-4 h-4" />
                          Buy Now
                        </button>

                        <button
                          onClick={() => openProductWhatsApp(selectedProduct)}
                          className="bg-green-500 hover:bg-green-600 text-white text-xs font-black uppercase tracking-wider py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-green-100 cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Ask WhatsApp
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          onClick={() => openProductDetail(selectedProduct)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border-none shadow-md hover:scale-[1.02] active:scale-95"
                        >
                          <Eye className="w-4 h-4" />
                          Full Detail Page
                        </button>

                        <button
                          onClick={() => toggleWishlist(selectedProduct)}
                          className={`w-full text-xs font-black uppercase tracking-wider py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            isWishlistActive(selectedProduct.id)
                              ? "bg-red-600 text-white hover:bg-red-700"
                              : "bg-red-50 text-red-600 hover:bg-red-100"
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              isWishlistActive(selectedProduct.id)
                                ? "fill-white"
                                : ""
                            }`}
                          />
                          {isWishlistActive(selectedProduct.id)
                            ? "Saved"
                            : "Wishlist"}
                        </button>
                      </div>

                      <button
                        onClick={() => openPreviewModal(selectedProduct)}
                        className="w-full bg-brand-gold hover:opacity-90 text-white text-xs font-black uppercase tracking-wider py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand-gold/10"
                      >
                        <Shirt className="w-4 h-4 text-white/80" />
                        Preview Outfit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPreviewModalOpen && selectedProduct && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white max-w-5xl w-full rounded-2xl shadow-2xl overflow-hidden border border-brand-border/60 relative text-left"
            >
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="absolute top-4 right-4 bg-cream-card/60 hover:bg-slate-200 text-slate-600 rounded-full p-1.5 transition-colors focus:outline-none z-10 shadow cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="bg-slate-950 p-8 flex items-center justify-center min-h-[520px]">
                  <div className="w-full max-w-sm bg-white/10 border border-white/10 rounded-[2rem] p-6 text-center">
                    <div className="mx-auto w-44 h-72 rounded-full bg-gradient-to-b from-slate-200 to-slate-400 border-8 border-white/10 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-5 left-1/2 -translate-x-1/2 w-16 h-16 bg-cream-card/60 rounded-full border-4 border-white shadow" />
                      <div className="absolute top-24 left-1/2 -translate-x-1/2 w-28 h-28 bg-blue-600 rounded-3xl shadow-xl flex items-center justify-center">
                        <Shirt className="w-10 h-10 text-white" />
                      </div>
                      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-24 h-28 bg-slate-800 rounded-b-3xl shadow-xl" />
                    </div>

                    <p className="text-white text-xs font-black uppercase tracking-widest mt-6">
                      Virtual Mannequin Preview
                    </p>
                    <p className="text-slate-400 text-xs font-semibold mt-2">
                      This is a simple preview before final order. Advanced AI
                      model training can be added later.
                    </p>
                  </div>
                </div>

                <div className="p-8">
                  <p className="text-[10px] uppercase text-sage-green font-extrabold tracking-widest">
                    Outfit Preview
                  </p>

                  <h3 className="text-2xl font-bold text-brand-dark mt-1">
                    See how this outfit may look
                  </h3>

                  <p className="text-xs text-slate-500 font-semibold mt-2">
                    This preview helps the customer understand the selected
                    outfit before placing the final order.
                  </p>

                  <div className="h-px bg-cream-card/60 my-6" />

                  {previewLoading ? (
                    <div className="py-20 text-center">
                      <p className="text-sm font-bold text-slate-700">
                        Generating preview...
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Please wait.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <PreviewItem
                        title="Main Product"
                        name={
                          generatedOutfit?.main_item?.name ||
                          selectedProduct.name
                        }
                        image={getOutfitImage(generatedOutfit?.main_item)}
                        placeholderImage={placeholderImage}
                      />

                      <PreviewItem
                        title="Pants / Jeans"
                        name={
                          generatedOutfit?.outfit?.pant?.name ||
                          generatedOutfit?.outfit?.pants_or_jeans?.name ||
                          "Not available"
                        }
                        image={getOutfitImage(
                          generatedOutfit?.outfit?.pant ||
                            generatedOutfit?.outfit?.pants_or_jeans,
                        )}
                        placeholderImage={placeholderImage}
                      />

                      <PreviewItem
                        title="Shoes"
                        name={
                          generatedOutfit?.outfit?.shoes?.name ||
                          "Not available"
                        }
                        image={getOutfitImage(generatedOutfit?.outfit?.shoes)}
                        placeholderImage={placeholderImage}
                      />

                      <PreviewItem
                        title="Accessory"
                        name={
                          generatedOutfit?.outfit?.accessory?.name ||
                          "Not available"
                        }
                        image={getOutfitImage(
                          generatedOutfit?.outfit?.accessory,
                        )}
                        placeholderImage={placeholderImage}
                      />

                      <button
                        onClick={openOrderModal}
                        disabled={isOutOfStock(selectedProduct)}
                        className={`w-full mt-6 text-white text-xs font-bold uppercase tracking-wider py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md ${
                          isOutOfStock(selectedProduct)
                            ? "bg-slate-300 cursor-not-allowed"
                            : "bg-brand-gold hover:opacity-90 cursor-pointer shadow-brand-gold/10"
                        }`}
                      >
                        <ShoppingBag className="w-4 h-4 text-white/80" />
                        {isOutOfStock(selectedProduct)
                          ? "Out of Stock"
                          : "Continue to Order"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOrderModalOpen && selectedProduct && (
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden border border-brand-border/60 relative text-left"
            >
              <button
                onClick={closeOrderModal}
                className="absolute top-4 right-4 bg-cream-card/60 hover:bg-slate-200 text-slate-600 rounded-full p-1.5 transition-colors focus:outline-none z-10 shadow cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <form onSubmit={submitOrder} className="p-6 space-y-4">
                <div>
                  <p className="text-[10px] uppercase text-sage-green font-extrabold tracking-widest">
                    Place Order
                  </p>

                  <h3 className="text-2xl font-bold text-brand-dark mt-1">
                    {selectedProduct.name}
                  </h3>

                  <p className="text-xs text-slate-500 font-bold mt-1">
                    {formatPrice(selectedProduct.price)} / Cash on Delivery
                  </p>

                  <p className="text-xs text-slate-400 font-bold mt-1">
                    Category: {selectedProduct.category}
                  </p>

                  <p
                    className={`text-xs font-black mt-2 ${
                      selectedProduct.stock_quantity <= 5
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }`}
                  >
                    Only {selectedProduct.stock_quantity} item(s) available in
                    stock
                  </p>
                </div>

                <div className="h-px bg-cream-card/60" />

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                    Full Name
                  </label>

                  <input
                    value={orderForm.customer_name}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        customer_name: event.target.value,
                      })
                    }
                    placeholder="Hammad Ahmad"
                    className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                    Email Optional
                  </label>

                  <input
                    type="email"
                    value={orderForm.customer_email}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        customer_email: event.target.value,
                      })
                    }
                    placeholder="customer@gmail.com"
                    className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                    Phone Number
                  </label>

                  <input
                    value={orderForm.customer_phone}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        customer_phone: event.target.value,
                      })
                    }
                    placeholder="03000000000"
                    className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                    Delivery Address
                  </label>

                  <textarea
                    value={orderForm.customer_address}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        customer_address: event.target.value,
                      })
                    }
                    placeholder="House no, street, city"
                    rows={3}
                    className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                    Quantity
                  </label>

                  <input
                    type="number"
                    min="1"
                    max={selectedProduct.stock_quantity}
                    value={orderForm.quantity}
                    onChange={(event) =>
                      setOrderForm({
                        ...orderForm,
                        quantity: event.target.value,
                      })
                    }
                    className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                  />

                  <p className="text-[10px] text-slate-400 font-bold mt-2">
                    Maximum allowed quantity: {selectedProduct.stock_quantity}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={orderSubmitting || isOutOfStock(selectedProduct)}
                  className="w-full bg-brand-gold hover:opacity-90 disabled:bg-blue-300 text-white text-xs font-bold uppercase tracking-wider py-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-brand-gold/10"
                >
                  <ShoppingBag className="w-4 h-4 text-white/80" />
                  {orderSubmitting ? "Placing Order..." : "Confirm Order"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-cream-base border border-slate-100 rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
        {label}
      </p>

      <p className="text-xs font-black text-brand-dark mt-1">
        {value || "N/A"}
      </p>
    </div>
  );
}

function PreviewItem({
  title,
  name,
  image,
  placeholderImage,
}: {
  title: string;
  name: string;
  image: string;
  placeholderImage: string;
}) {
  return (
    <div className="flex items-center gap-4 p-3 bg-cream-base border border-slate-100 rounded-xl">
      <img
        src={image}
        alt={name}
        className="w-16 h-16 rounded-xl object-cover bg-white border border-brand-border/60"
        onError={(event) => {
          event.currentTarget.src = placeholderImage;
        }}
      />

      <div>
        <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest">
          {title}
        </p>

        <p className="text-sm font-black text-brand-dark mt-1">{name}</p>
      </div>
    </div>
  );
}
