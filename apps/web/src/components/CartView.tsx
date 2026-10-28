"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, ArrowRight } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import { useCart } from "@/features/cart/useCart";
import { notify } from "@/lib/notify";

function formatPKR(value: string | number | undefined) {
  return `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;
}

export default function CartView() {
  const { cartItems, cartCount, cartTotal, updateCartQuantity, removeFromCart, clearCart, syncing } = useCart();

  if (syncing) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-slate-500 font-semibold" role="status">
        Loading your cart...
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-cream-base px-6 py-16 font-sans text-left">
        <div className="max-w-xl mx-auto bg-white border border-brand-border/60 rounded-3xl p-10 text-center shadow-sm">
          <ShoppingBag className="w-14 h-14 text-slate-300 mx-auto mb-4" />
          <h1 className="text-3xl font-black text-brand-dark">Your cart is empty</h1>
          <p className="text-sm text-slate-500 font-semibold mt-3">Add something you love from the shop.</p>
          <Link
            href="/shop"
            className="inline-block mt-6 bg-brand-gold text-white px-6 py-4 rounded-xl text-xs font-black uppercase tracking-wider"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-cream-base px-4 sm:px-6 py-10 font-sans text-left">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-black text-brand-dark">Shopping cart</h1>
        <p className="text-sm text-slate-500 font-semibold mt-2">
          {cartCount} item{cartCount === 1 ? "" : "s"}
        </p>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6 mt-8 items-start">
          <div className="bg-white border border-brand-border/60 rounded-3xl overflow-hidden divide-y divide-slate-100">
            {cartItems.map((item) => (
              <div
                key={`${item.product.id}-${item.size || "M"}`}
                className="p-4 sm:p-5 flex gap-4"
                data-testid="cart-row"
              >
                <ProductImage
                  src={item.product.image_url || item.product.image}
                  alt={item.product.name}
                  className="w-24 h-28 object-cover rounded-xl bg-slate-100"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900 leading-snug">{item.product.name}</p>
                      <p className="text-xs text-slate-500 font-semibold mt-1">
                        {item.product.category}
                        {item.size ? ` · Size ${item.size}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        removeFromCart(item.product.id, item.size);
                        notify(`${item.product.name} removed from cart.`);
                      }}
                      aria-label={`Remove ${item.product.name}`}
                      className="text-slate-400 hover:text-red-600 p-1 h-fit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-end justify-between mt-4">
                    <div className="inline-flex items-center border border-slate-200 rounded-xl">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${item.product.name}`}
                        onClick={() => updateCartQuantity(item.product.id, item.quantity - 1, item.size)}
                        className="px-3 py-2 text-slate-600 hover:bg-slate-50"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-sm font-black" data-testid="cart-quantity">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${item.product.name}`}
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1, item.size)}
                        className="px-3 py-2 text-slate-600 hover:bg-slate-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="font-black text-slate-900">{formatPKR(Number(item.product.price) * item.quantity)}</p>
                  </div>
                </div>
              </div>
            ))}
            <div className="p-4">
              <button type="button" onClick={clearCart} className="text-xs font-black uppercase tracking-wider text-slate-500 hover:text-red-600">
                Clear cart
              </button>
            </div>
          </div>

          <aside className="bg-white border border-brand-border/60 rounded-3xl p-6 shadow-sm">
            <h2 className="text-lg font-black text-brand-dark">Order summary</h2>
            <div className="flex justify-between text-sm font-semibold text-slate-600 mt-4">
              <span>Subtotal</span>
              <span>{formatPKR(cartTotal)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-slate-600 mt-2">
              <span>Delivery</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="border-t border-slate-100 mt-4 pt-4 flex justify-between font-black text-slate-900">
              <span>Total</span>
              <span>{formatPKR(cartTotal)}</span>
            </div>
            <Link
              href="/checkout"
              className="mt-6 flex items-center justify-center gap-2 bg-brand-gold text-white px-5 py-4 rounded-xl text-xs font-black uppercase tracking-wider"
            >
              Checkout <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/shop" className="mt-3 block text-center text-xs font-black uppercase tracking-wider text-slate-500">
              Continue shopping
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}
