"use client";

import { PLACEHOLDER_IMAGE } from "@/lib/config";
import React from "react";
import { useNavigate } from "@/lib/navigation";
import { ArrowLeft, Heart, ShoppingBag, ShoppingCart } from "lucide-react";
import { CartProduct } from "@/features/cart/types";
import { useCart } from "@/features/cart/useCart";
import { useWishlist } from "@/features/wishlist/useWishlist";

function formatPKR(value: string | number | undefined) {
  const num = Number(value || 0);
  return `Rs. ${num.toLocaleString("en-PK")}`;
}

function getProductImage(product: CartProduct) {
  return (
    product.image_url ||
    product.image ||
    PLACEHOLDER_IMAGE
  );
}

export default function WishlistView() {
  const navigate = useNavigate();
  const { wishlistItems, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  const handleAddToCart = (product: CartProduct) => {
    if (
      Number(product.stock_quantity || 0) <= 0 ||
      product.status === "Out of Stock" ||
      product.status === "Inactive"
    ) {
      alert("This product is currently out of stock.");
      return;
    }

    addToCart(product);
  };

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-cream-base px-6 py-12 text-left font-sans relative">
      {/* Background ambient light gradients */}
      <div className="absolute right-0 top-20 w-96 h-96 bg-blue-100/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute left-0 bottom-20 w-96 h-96 bg-blue-50/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <button
          onClick={() => navigate("/shop")}
          className="mb-8 bg-white hover:bg-cream-card/60 border border-brand-border/60 text-slate-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer border-none shadow-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Shop
        </button>

        {/* Wishlist Header */}
        <div className="mb-10 max-w-3xl">
          <p className="text-[10px] uppercase tracking-widest text-blue-700 font-extrabold font-sans mb-2">
            {wishlistItems.length}{" "}
            {wishlistItems.length === 1 ? "item" : "items"} saved
          </p>

          <h1 className="text-4xl sm:text-5xl font-serif font-bold text-brand-dark tracking-tight leading-tight">
            My Wishlist
          </h1>
          <div className="w-12 h-1 bg-brand-gold mt-4 rounded-full" />

          <p className="text-sm text-slate-500 font-sans leading-relaxed mt-6 font-medium max-w-2xl">
            Items you&apos;ve saved for later
          </p>
        </div>

        {wishlistItems.length === 0 ? (
          /* Empty State Section */
          <div className="bg-white border border-blue-200/60 rounded-[2rem] p-12 text-center shadow-sm max-w-lg mx-auto mt-10">
            <Heart className="w-12 h-12 text-slate-350 mx-auto mb-4 stroke-[1.5]" />

            <h2 className="text-xl font-serif font-bold text-brand-dark">
              Your wishlist is empty
            </h2>

            <p className="text-xs text-slate-500 font-sans mt-2 max-w-sm mx-auto">
              Save items you love by tapping the heart icon
            </p>

            <button
              onClick={() => navigate("/shop")}
              className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 border-none shadow-md cursor-pointer hover:scale-[1.02] active:scale-95 transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              Browse Shop
            </button>
          </div>
        ) : (
          /* Products Grid Section - Responsive (4 columns desktop, 2 tablet, 1 mobile) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {wishlistItems.map((product) => (
              <article
                key={product.id}
                className="bg-white border border-brand-border/60 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col justify-between"
              >
                <div className="relative aspect-[3/4] bg-cream-card/60 overflow-hidden">
                  <img
                    src={getProductImage(product)}
                    alt={product.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                    onError={(event) => {
                      event.currentTarget.src =
                        PLACEHOLDER_IMAGE;
                    }}
                  />

                  {/* Remove from Wishlist button (heart icon) */}
                  <button
                    onClick={() => removeFromWishlist(product.id)}
                    className="absolute top-3 right-3 w-10 h-10 rounded-full bg-red-650 text-white shadow-lg flex items-center justify-center z-20 hover:scale-110 active:scale-95 transition-all border-none cursor-pointer"
                    title="Remove from Wishlist"
                  >
                    <Heart className="w-5 h-5 fill-white text-white" />
                  </button>
                </div>

                <div className="p-4 flex flex-col justify-between flex-1">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-[10px] uppercase text-slate-400 font-extrabold font-sans mb-1">
                      <span>
                        {product.style || product.cultural_tag || "Casual"}
                      </span>
                      <span>{product.color || "N/A"}</span>
                    </div>

                    <h3 className="text-xs uppercase font-extrabold tracking-wider text-brand-dark line-clamp-1">
                      {product.name}
                    </h3>

                    <p className="text-[10px] text-slate-400 font-black mt-1 uppercase tracking-wider">
                      {product.category}
                    </p>
                  </div>

                  <div className="mt-3 space-y-3">
                    <p className="text-xs font-bold text-slate-500 font-mono">
                      {formatPKR(product.price)}
                    </p>

                    <button
                      onClick={() => handleAddToCart(product)}
                      className="w-full bg-brand-gold hover:opacity-90 text-white text-xs font-black uppercase tracking-wider py-3 rounded-xl transition-all flex items-center justify-center gap-2 border-none shadow-md cursor-pointer"
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
      </div>
    </div>
  );
}
