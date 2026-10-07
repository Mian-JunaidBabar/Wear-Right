"use client";

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "@/lib/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Home,
  User,
  Camera,
  ShoppingBag,
  ShoppingCart,
  ShieldAlert,
  Menu,
  X,
  LogIn,
  LogOut,
  Minus,
  Plus,
  Trash2,
  ClipboardList,
  Heart,
  Info,
  Phone,
} from "lucide-react";
import { ViewType } from "@/lib/types";
import { CartItem } from "@/features/cart/types";
import { ADMIN_WHATSAPP_NUMBER, PLACEHOLDER_IMAGE } from "@/lib/config";
import { notify } from "@/lib/notify";
import { usePathname, useSetView, viewFromPath } from "@/lib/navigation";
import { useAuth } from "@/features/auth/AuthProvider";
import { useCart } from "@/features/cart/useCart";
import { useWishlist } from "@/features/wishlist/useWishlist";
import { lastOrderStore } from "@/features/orders/lastOrder";
import { ordersApi, orderErrorMessage } from "@/features/orders/api";

function formatPKR(value: string | number | undefined) {
  const num = Number(value || 0);
  return `Rs. ${num.toLocaleString("en-PK")}`;
}

function getCartImage(item: CartItem) {
  return (
    item.product.image_url ||
    item.product.image ||
    PLACEHOLDER_IMAGE
  );
}

export default function Navbar() {
  const navigate = useNavigate();
  const setView = useSetView();
  const pathname = usePathname();
  const currentView = viewFromPath(pathname);
  const { user, logout } = useAuth();
  const { cartItems, cartCount, cartTotal, updateCartQuantity, removeFromCart, clearCart } = useCart();
  const wishlistCount = useWishlist().wishlistItems.length;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);

  const [checkoutForm, setCheckoutForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    customer_address: "",
    payment_status: "Cash on Delivery",
  });

  const adminWhatsAppNumber = ADMIN_WHATSAPP_NUMBER;
  const whatsappMessage = "Hello Admin, I need help regarding Wear Right.";

  const navItems = [
    { id: "home" as ViewType, label: "Home", icon: Home },
    { id: "shop" as ViewType, label: "Shop", icon: ShoppingBag },
    { id: "facescan" as ViewType, label: "Face Scan", icon: Camera },
    { id: "about" as ViewType, label: "About", icon: Info },
    { id: "contact" as ViewType, label: "Contact", icon: Phone },
  ];

  const goToView = (view: ViewType) => {
    setView(view);
    setMobileMenuOpen(false);
    setCartOpen(false);
  };

  const handleSignOut = async () => {
    await logout();
    setProfileOpen(false);
    notify("Logged out successfully.");
    goToView("home");
  };

  const openWhatsApp = () => {
    window.open(
      `https://wa.me/${adminWhatsAppNumber}?text=${encodeURIComponent(whatsappMessage)}`,
      "_blank",
    );
  };

  const openCheckout = () => {
    if (cartItems.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    // Orders belong to an account: guests sign in first. The cart is kept in this browser.
    if (!user.isLoggedIn) {
      notify("Please log in to check out.");
      setCartOpen(false);
      setMobileMenuOpen(false);
      navigate(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    setCartOpen(false);
    setCheckoutOpen(true);
  };

  const closeCheckout = () => {
    setCheckoutOpen(false);
  };

  const submitCartCheckout = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!checkoutForm.customer_name.trim()) {
      alert("Please enter your full name.");
      return;
    }

    if (!checkoutForm.customer_phone.trim()) {
      alert("Please enter your phone number.");
      return;
    }

    if (!checkoutForm.customer_address.trim()) {
      alert("Please enter your delivery address.");
      return;
    }

    if (cartItems.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    try {
      setCheckoutSubmitting(true);

      const uniqueOrderCode = `WR-${Date.now()}`;

      for (const item of cartItems) {
        await ordersApi.create({
          order_code: uniqueOrderCode,
          customer_name: checkoutForm.customer_name,
          customer_email: checkoutForm.customer_email,
          customer_phone: checkoutForm.customer_phone,
          customer_address: checkoutForm.customer_address,
          product: Number(item.product.id),
          quantity: item.quantity,
          order_status: "Pending",
          payment_status: checkoutForm.payment_status,
        });
      }

      const orderSummary = {
        order_code: uniqueOrderCode,
        customer_name: checkoutForm.customer_name,
        customer_email: checkoutForm.customer_email,
        customer_phone: checkoutForm.customer_phone,
        customer_address: checkoutForm.customer_address,
        payment_status: checkoutForm.payment_status,
        total: cartTotal,
        created_at: new Date().toISOString(),
        items: cartItems.map((item) => ({
          id: item.product.id,
          name: item.product.name,
          category: item.product.category,
          price: item.product.price,
          quantity: item.quantity,
          image: item.product.image || null,
          image_url: item.product.image_url || null,
        })),
      };

      lastOrderStore.set(orderSummary);

      clearCart();
      setCheckoutOpen(false);
      setCheckoutForm({
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        customer_address: "",
        payment_status: "Cash on Delivery",
      });

      navigate("/order-confirmation");
    } catch (error) {
      console.error("Checkout Error:", error);
      alert(orderErrorMessage(error));
    } finally {
      setCheckoutSubmitting(false);
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm w-full">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <button
            onClick={() => goToView("home")}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
              <img
                src="/brand/wr-icon.png"
                alt="Wear Right Icon"
                className="w-11 h-11 object-contain"
                onError={(event) => {
                  event.currentTarget.src = "/brand/wr-monogram.png";
                }}
              />
            </div>

            <div className="flex flex-col text-left leading-none">
              <span className="font-display text-2xl font-black tracking-tight text-slate-900">
                Wear Right
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-sans mt-1">
                Right Style. Right You.
              </span>
            </div>
          </button>

          <div className="hidden xl:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = currentView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => goToView(item.id)}
                  className={`relative px-4 py-3 text-xs font-poppins font-bold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                    isActive ? "text-black" : "text-black/60 hover:text-black"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavLine"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-black"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                      }}
                    />
                  )}

                  <span className="uppercase tracking-wider">{item.label}</span>

                  {item.id === "wishlist" && wishlistCount > 0 && (
                    <span className="ml-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                      {wishlistCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="hidden xl:flex items-center gap-3 relative">
            <button
              onClick={() => setCartOpen(!cartOpen)}
              className="relative w-12 h-12 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-all shadow-sm flex items-center justify-center cursor-pointer"
              title="Cart"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                {cartCount}
              </span>
            </button>

            {user.isStaff && (
              <button
                onClick={() => goToView("admin")}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer ${
                  currentView === "admin"
                    ? "bg-blue-600 text-white"
                    : "bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white"
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                Admin
              </button>
            )}

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className={`w-12 h-12 rounded-full border-2 transition-all duration-200 flex items-center justify-center overflow-hidden cursor-pointer shadow-sm ${
                  profileOpen
                    ? "border-blue-600 ring-4 ring-blue-50"
                    : "border-slate-200 hover:border-blue-600 bg-white"
                }`}
                title="Account Menu"
              >
                {user.isLoggedIn && user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full object-cover"
                    onError={(event) => {
                      event.currentTarget.src = "";
                    }}
                  />
                ) : (
                  <User className="w-5 h-5 text-slate-500" />
                )}
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    className="absolute top-14 right-0 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-[80] p-2 text-left"
                  >
                    <div className="px-3 py-3 border-b border-slate-100 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                        {user.isLoggedIn && user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">
                          {user.isLoggedIn ? user.name : "Guest User"}
                        </p>
                        <p className="text-xs text-slate-400 font-bold truncate">
                          {user.isLoggedIn ? user.email : "Not logged in"}
                        </p>
                      </div>
                    </div>

                    <div className="py-1">
                      {user.isLoggedIn ? (
                        <>
                          <button
                            onClick={() => {
                              goToView("profile");
                              setProfileOpen(false);
                            }}
                            className="w-full px-3 py-2.5 text-xs font-bold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors text-left cursor-pointer"
                          >
                            <User className="w-4 h-4 text-slate-400" />
                            Profile
                          </button>

                          <button
                            onClick={() => {
                              goToView("wishlist");
                              setProfileOpen(false);
                            }}
                            className="w-full px-3 py-2.5 text-xs font-bold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-xl flex items-center justify-between transition-colors text-left cursor-pointer"
                          >
                            <span className="flex items-center gap-3">
                              <Heart className="w-4 h-4 text-slate-400" />
                              Wishlist
                            </span>
                            {wishlistCount > 0 && (
                              <span className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                                {wishlistCount}
                              </span>
                            )}
                          </button>

                          <button
                            onClick={() => {
                              goToView("my-orders");
                              setProfileOpen(false);
                            }}
                            className="w-full px-3 py-2.5 text-xs font-bold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors text-left cursor-pointer"
                          >
                            <ClipboardList className="w-4 h-4 text-slate-400" />
                            My Orders
                          </button>

                          <div className="h-px bg-slate-100 my-1" />

                          <button
                            onClick={handleSignOut}
                            className="w-full px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-3 transition-colors text-left cursor-pointer"
                          >
                            <LogOut className="w-4 h-4 text-slate-400" />
                            Logout
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              goToView("auth");
                              setProfileOpen(false);
                            }}
                            className="w-full px-3 py-2.5 text-xs font-bold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors text-left cursor-pointer"
                          >
                            <LogIn className="w-4 h-4 text-slate-400" />
                            Login / Sign Up
                          </button>

                          <button
                            onClick={() => {
                              goToView("wishlist");
                              setProfileOpen(false);
                            }}
                            className="w-full px-3 py-2.5 text-xs font-bold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-xl flex items-center justify-between transition-colors text-left cursor-pointer"
                          >
                            <span className="flex items-center gap-3">
                              <Heart className="w-4 h-4 text-slate-400" />
                              Wishlist
                            </span>
                            {wishlistCount > 0 && (
                              <span className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                                {wishlistCount}
                              </span>
                            )}
                          </button>

                          <button
                            onClick={() => {
                              goToView("my-orders");
                              setProfileOpen(false);
                            }}
                            className="w-full px-3 py-2.5 text-xs font-bold text-slate-700 hover:text-blue-600 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors text-left cursor-pointer"
                          >
                            <ClipboardList className="w-4 h-4 text-slate-400" />
                            My Orders
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {cartOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  className="absolute top-16 right-0 w-[420px] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-[80]"
                >
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">
                        Shopping Cart
                      </h3>
                      <p className="text-xs text-slate-400 font-bold mt-1">
                        {cartCount} item(s) selected
                      </p>
                    </div>

                    <button
                      onClick={() => setCartOpen(false)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {cartItems.length === 0 ? (
                    <div className="p-8 text-center">
                      <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm font-black text-slate-700">
                        Cart is empty
                      </p>
                      <p className="text-xs text-slate-400 font-semibold mt-1">
                        Add product from shop
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                        {cartItems.map((item) => (
                          <div key={item.product.id} className="p-4 flex gap-3">
                            <img
                              src={getCartImage(item)}
                              alt={item.product.name}
                              className="w-16 h-20 rounded-xl object-cover bg-slate-100 border border-slate-200"
                              onError={(event) => {
                                event.currentTarget.src =
                                  PLACEHOLDER_IMAGE;
                              }}
                            />

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-black text-slate-900 line-clamp-1">
                                {item.product.name}
                              </p>

                              <p className="text-xs text-slate-400 font-bold mt-1">
                                {item.product.category}
                              </p>

                              <p className="text-sm font-black text-blue-600 mt-2">
                                {formatPKR(item.product.price)}
                              </p>

                              <div className="mt-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      updateCartQuantity(
                                        item.product.id,
                                        item.quantity - 1,
                                      )
                                    }
                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>

                                  <span className="w-8 text-center text-sm font-black">
                                    {item.quantity}
                                  </span>

                                  <button
                                    onClick={() =>
                                      updateCartQuantity(
                                        item.product.id,
                                        item.quantity + 1,
                                      )
                                    }
                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <button
                                  onClick={() =>
                                    removeFromCart(item.product.id)
                                  }
                                  className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-5 border-t border-slate-100 bg-slate-50">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm font-bold text-slate-500">
                            Total
                          </span>
                          <span className="text-xl font-black text-slate-900">
                            {formatPKR(cartTotal)}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={clearCart}
                            className="flex-1 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider hover:bg-slate-100"
                          >
                            Clear
                          </button>

                          <button
                            onClick={openCheckout}
                            className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-wider hover:bg-blue-700"
                          >
                            Checkout
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex xl:hidden items-center gap-3">
            <button
              onClick={() => setCartOpen(!cartOpen)}
              className="relative p-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center">
                {cartCount}
              </span>
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-slate-600 hover:text-slate-900 focus:outline-none transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="xl:hidden w-full bg-white border-t border-slate-200 overflow-hidden text-left"
            >
              <div className="px-6 py-4 flex flex-col gap-2">
                {/* User Info Header on Mobile Menu */}
                <div className="mb-2 p-3 bg-slate-50 rounded-xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-300">
                    {user.isLoggedIn && user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 truncate">
                      {user.isLoggedIn ? user.name : "Guest"}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold truncate">
                      {user.isLoggedIn ? user.email : "Log in to save settings"}
                    </p>
                  </div>
                </div>

                {/* Primary Nav Items */}
                <p className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold px-1 mb-1">
                  Menu
                </p>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => goToView(item.id)}
                      className={`flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}

                <div className="h-px bg-slate-100 my-2" />

                {/* Account Section inside Mobile Drawer */}
                <p className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold px-1 mb-1">
                  Account
                </p>
                {user.isLoggedIn ? (
                  <>
                    <button
                      onClick={() => goToView("profile")}
                      className={`flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                        currentView === "profile"
                          ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <User className="w-5 h-5" />
                      <span>Profile</span>
                    </button>

                    <button
                      onClick={() => goToView("wishlist")}
                      className={`flex items-center justify-between gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                        currentView === "wishlist"
                          ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Heart className="w-5 h-5" />
                        <span>Wishlist</span>
                      </span>
                      {wishlistCount > 0 && (
                        <span className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                          {wishlistCount}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => goToView("my-orders")}
                      className={`flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                        currentView === "my-orders"
                          ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <ClipboardList className="w-5 h-5" />
                      <span>My Orders</span>
                    </button>

                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-lg text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => goToView("auth")}
                      className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-lg bg-slate-900 text-white transition-all cursor-pointer"
                    >
                      <LogIn className="w-5 h-5" />
                      <span>Login / Sign Up</span>
                    </button>

                    <button
                      onClick={() => goToView("wishlist")}
                      className={`flex items-center justify-between gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                        currentView === "wishlist"
                          ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Heart className="w-5 h-5" />
                        <span>Wishlist</span>
                      </span>
                      {wishlistCount > 0 && (
                        <span className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                          {wishlistCount}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => goToView("my-orders")}
                      className={`flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                        currentView === "my-orders"
                          ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <ClipboardList className="w-5 h-5" />
                      <span>My Orders</span>
                    </button>
                  </>
                )}

                {user.isStaff && (
                  <>
                    <div className="h-px bg-slate-100 my-2" />

                    <button
                      onClick={() => goToView("admin")}
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-wider cursor-pointer"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      Admin
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <AnimatePresence>
        {checkoutOpen && (
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center z-90 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden border border-slate-200 relative text-left"
            >
              <button
                onClick={closeCheckout}
                className="absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full p-2 transition-colors z-10 shadow"
              >
                <X className="w-4 h-4" />
              </button>

              <form onSubmit={submitCartCheckout} className="p-6 space-y-5">
                <div>
                  <p className="text-[10px] uppercase text-blue-600 font-extrabold tracking-widest">
                    Checkout
                  </p>

                  <h3 className="text-2xl font-black text-slate-900 mt-1">
                    Complete Your Order
                  </h3>

                  <p className="text-xs text-slate-500 font-bold mt-1">
                    {cartCount} item(s) selected / Total {formatPKR(cartTotal)}
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 max-h-48 overflow-y-auto space-y-3">
                  {cartItems.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between gap-3 bg-white border border-slate-100 rounded-xl p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={getCartImage(item)}
                          alt={item.product.name}
                          className="w-12 h-14 rounded-lg object-cover bg-slate-100 border border-slate-200"
                          onError={(event) => {
                            event.currentTarget.src =
                              PLACEHOLDER_IMAGE;
                          }}
                        />

                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 line-clamp-1">
                            {item.product.name}
                          </p>
                          <p className="text-xs text-slate-400 font-bold">
                            Quantity: {item.quantity}
                          </p>
                        </div>
                      </div>

                      <p className="text-sm font-black text-blue-600 whitespace-nowrap">
                        {formatPKR(
                          Number(item.product.price || 0) * item.quantity,
                        )}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                      Full Name
                    </label>

                    <input
                      value={checkoutForm.customer_name}
                      onChange={(event) =>
                        setCheckoutForm({
                          ...checkoutForm,
                          customer_name: event.target.value,
                        })
                      }
                      placeholder="Full name"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                      Phone Number
                    </label>

                    <input
                      value={checkoutForm.customer_phone}
                      onChange={(event) =>
                        setCheckoutForm({
                          ...checkoutForm,
                          customer_phone: event.target.value,
                        })
                      }
                      placeholder="03000000000"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                    Email Optional
                  </label>

                  <input
                    type="email"
                    value={checkoutForm.customer_email}
                    onChange={(event) =>
                      setCheckoutForm({
                        ...checkoutForm,
                        customer_email: event.target.value,
                      })
                    }
                    placeholder="customer@gmail.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                    Delivery Address
                  </label>

                  <textarea
                    value={checkoutForm.customer_address}
                    onChange={(event) =>
                      setCheckoutForm({
                        ...checkoutForm,
                        customer_address: event.target.value,
                      })
                    }
                    placeholder="House no, street, city"
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-500">
                    Order Total
                  </span>
                  <span className="text-2xl font-black text-slate-900">
                    {formatPKR(cartTotal)}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={checkoutSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-black uppercase tracking-wider py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-100"
                >
                  <ShoppingBag className="w-4 h-4" />
                  {checkoutSubmitting ? "Placing Order..." : "Place Order"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <button
        onClick={openWhatsApp}
        className="fixed bottom-7 right-7 z-50 w-16 h-16 rounded-full bg-[#25D366] text-white shadow-2xl hover:bg-[#1ebe5d] hover:scale-105 transition-all flex items-center justify-center"
        title="Chat on WhatsApp"
        aria-label="Chat on WhatsApp"
      >
        <svg
          viewBox="0 0 32 32"
          className="w-9 h-9 fill-white"
          aria-hidden="true"
        >
          <path d="M16.02 3C8.85 3 3.04 8.8 3.04 15.95c0 2.29.6 4.52 1.75 6.49L3 29l6.73-1.76a12.9 12.9 0 0 0 6.29 1.6h.01c7.16 0 12.98-5.8 12.98-12.95C29 8.8 23.18 3 16.02 3Zm0 23.65h-.01c-1.92 0-3.8-.52-5.45-1.5l-.39-.23-3.99 1.04 1.07-3.88-.25-.4a10.67 10.67 0 0 1-1.65-5.73c0-5.94 4.84-10.77 10.79-10.77 2.88 0 5.59 1.12 7.63 3.15a10.7 10.7 0 0 1 3.16 7.62c0 5.94-4.84 10.76-10.91 10.76Zm5.9-8.06c-.32-.16-1.9-.94-2.19-1.04-.29-.11-.5-.16-.71.16-.21.32-.81 1.04-.99 1.25-.18.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.58-.95-.85-1.59-1.9-1.78-2.22-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.97-2.34-.26-.61-.52-.53-.71-.54h-.61c-.21 0-.56.08-.85.4-.29.32-1.11 1.08-1.11 2.64s1.14 3.07 1.3 3.28c.16.21 2.25 3.43 5.45 4.81.76.33 1.36.53 1.82.68.76.24 1.45.21 2 .13.61-.09 1.9-.78 2.17-1.53.27-.75.27-1.39.19-1.53-.08-.13-.29-.21-.61-.37Z" />
        </svg>
      </button>
    </>
  );
}
