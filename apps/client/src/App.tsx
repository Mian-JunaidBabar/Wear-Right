import React, { useEffect, useMemo, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";

import Navbar from "./components/Navbar";
import HomeView from "./components/HomeView";
import AuthView from "./components/AuthView";
import ProfileView from "./components/ProfileView";
import FaceScanView from "./components/FaceScanView";
import ShopView from "./components/ShopView";
import ProtectedAdminView from "./components/ProtectedAdminView";
import RecommendedProductsView from "./components/RecommendedProductsView";
import CompleteOutfitView from "./components/CompleteOutfitView";
import OrderConfirmationView from "./components/OrderConfirmationView";
import MyOrdersView from "./components/MyOrdersView";
import ProductDetailView from "./components/ProductDetailView";
import WishlistView from "./components/WishlistView";
import AboutView from "./components/AboutView";
import ContactView from "./components/ContactView";
import Footer from "./components/Footer";

import { ViewType, UserState } from "./types";
import { INITIAL_USER } from "./data";

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

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<UserState>(INITIAL_USER);

  const [selectedStyles, setSelectedStyles] = useState<string[]>([
    "Western",
    "Casual",
  ]);

  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"match" | "priceAsc" | "priceDesc">(
    "match",
  );

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [wishlistItems, setWishlistItems] = useState<CartProduct[]>([]);

  useEffect(() => {
    try {
      const savedWishlist = localStorage.getItem("wearRightWishlist");

      if (savedWishlist) {
        setWishlistItems(JSON.parse(savedWishlist));
      }
    } catch (error) {
      console.error("Wishlist Load Error:", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("wearRightWishlist", JSON.stringify(wishlistItems));
  }, [wishlistItems]);

  const toggleStyleFilter = (styleName: string) => {
    if (selectedStyles.includes(styleName)) {
      setSelectedStyles(selectedStyles.filter((style) => style !== styleName));
    } else {
      setSelectedStyles([...selectedStyles, styleName]);
    }
  };

  const toggleColorFilter = (colorName: string) => {
    if (selectedColors.includes(colorName)) {
      setSelectedColors(selectedColors.filter((color) => color !== colorName));
    } else {
      setSelectedColors([...selectedColors, colorName]);
    }
  };

  const resetFilters = () => {
    setSelectedStyles(["Western", "Casual", "Formal", "Eastern"]);
    setSelectedColors([]);
  };

  const addToCart = (product: CartProduct) => {
    setCartItems((prevItems) => {
      const existingItem = prevItems.find(
        (item) => String(item.product.id) === String(product.id),
      );

      if (existingItem) {
        return prevItems.map((item) =>
          String(item.product.id) === String(product.id)
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item,
        );
      }

      return [
        ...prevItems,
        {
          product,
          quantity: 1,
        },
      ];
    });

    alert(`${product.name} added to cart.`);
  };

  const removeFromCart = (productId: number | string) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => String(item.product.id) !== String(productId)),
    );
  };

  const updateCartQuantity = (productId: number | string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCartItems((prevItems) =>
      prevItems.map((item) =>
        String(item.product.id) === String(productId)
          ? {
              ...item,
              quantity,
            }
          : item,
      ),
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const isInWishlist = (productId: number | string) => {
    return wishlistItems.some((item) => String(item.id) === String(productId));
  };

  const addToWishlist = (product: CartProduct) => {
    setWishlistItems((prevItems) => {
      const exists = prevItems.some(
        (item) => String(item.id) === String(product.id),
      );

      if (exists) {
        alert(`${product.name} is already in wishlist.`);
        return prevItems;
      }

      alert(`${product.name} added to wishlist.`);
      return [...prevItems, product];
    });
  };

  const removeFromWishlist = (productId: number | string) => {
    setWishlistItems((prevItems) =>
      prevItems.filter((item) => String(item.id) !== String(productId)),
    );
  };

  const toggleWishlist = (product: CartProduct) => {
    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id);
      alert(`${product.name} removed from wishlist.`);
      return;
    }

    addToWishlist(product);
  };

  const cartCount = useMemo(() => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  }, [cartItems]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((total, item) => {
      return total + Number(item.product.price || 0) * item.quantity;
    }, 0);
  }, [cartItems]);

  const currentView = (
    location.pathname === "/"
      ? "home"
      : location.pathname.substring(1).split("/")[0]
  ) as ViewType;

  const setView = (view: ViewType) => {
    navigate(view === "home" ? "/" : `/${view}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900 font-sans">
      <Navbar
        currentView={currentView}
        setView={setView}
        user={user}
        setUser={setUser}
        selectedStyles={selectedStyles}
        toggleStyleFilter={toggleStyleFilter}
        selectedColors={selectedColors}
        toggleColorFilter={toggleColorFilter}
        resetFilters={resetFilters}
        cartCount={cartCount}
        cartItems={cartItems}
        cartTotal={cartTotal}
        updateCartQuantity={updateCartQuantity}
        removeFromCart={removeFromCart}
        clearCart={clearCart}
        wishlistCount={wishlistItems.length}
      />

      <main className="flex-1 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${location.pathname}${location.search}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="w-full"
          >
            <Routes location={location}>
              <Route path="/" element={<HomeView setView={setView} />} />

              <Route
                path="/auth"
                element={<AuthView user={user} setUser={setUser} />}
              />

              <Route
                path="/profile"
                element={<ProfileView user={user} setUser={setUser} />}
              />

              <Route
                path="/facescan"
                element={<FaceScanView user={user} setUser={setUser} />}
              />

              <Route
                path="/recommended"
                element={
                  <RecommendedProductsView user={user} addToCart={addToCart} />
                }
              />

              <Route
                path="/complete-outfit"
                element={
                  <CompleteOutfitView user={user} addToCart={addToCart} />
                }
              />

              <Route
                path="/shop"
                element={
                  <ShopView
                    setView={setView}
                    selectedStyles={selectedStyles}
                    setSelectedStyles={setSelectedStyles}
                    selectedColors={selectedColors}
                    setSelectedColors={setSelectedColors}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                    resetFilters={resetFilters}
                    addToCart={addToCart}
                    cartItems={cartItems}
                    wishlistItems={wishlistItems}
                    toggleWishlist={toggleWishlist}
                  />
                }
              />

              <Route
                path="/product/:id"
                element={
                  <ProductDetailView
                    addToCart={addToCart}
                    wishlistItems={wishlistItems}
                    toggleWishlist={toggleWishlist}
                  />
                }
              />

              <Route
                path="/wishlist"
                element={
                  <WishlistView
                    wishlistItems={wishlistItems}
                    removeFromWishlist={removeFromWishlist}
                    addToCart={addToCart}
                  />
                }
              />

              <Route path="/about" element={<AboutView />} />

              <Route path="/contact" element={<ContactView />} />

              <Route
                path="/order-confirmation"
                element={<OrderConfirmationView />}
              />

              <Route path="/my-orders" element={<MyOrdersView />} />

              <Route path="/admin" element={<ProtectedAdminView />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}
