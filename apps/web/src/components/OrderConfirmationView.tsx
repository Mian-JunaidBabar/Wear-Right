"use client";

import { PLACEHOLDER_IMAGE } from "@/lib/config";
import React from "react";
import { useLastOrder, type ConfirmationItem } from "@/features/orders/lastOrder";
import { useNavigate } from "@/lib/navigation";
import {
  CheckCircle2,
  ShoppingBag,
  Home,
  ReceiptText,
  PackageCheck,
  ClipboardList,
} from "lucide-react";

function formatPKR(value: string | number | undefined) {
  const num = Number(value || 0);
  return `Rs. ${num.toLocaleString("en-PK")}`;
}

function getItemImage(item: ConfirmationItem) {
  return (
    item.image_url ||
    item.image ||
    PLACEHOLDER_IMAGE
  );
}

export default function OrderConfirmationView() {
  const navigate = useNavigate();

  const confirmationData = useLastOrder();

  if (!confirmationData) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-cream-base px-6 py-16 flex items-center justify-center text-left font-sans">
        <div className="max-w-xl w-full bg-white border border-brand-border/60 rounded-3xl shadow-xl p-8 text-center">
          <ReceiptText className="w-14 h-14 text-slate-300 mx-auto mb-4" />

          <h1 className="text-3xl font-black text-brand-dark">
            No Order Found
          </h1>

          <p className="text-sm text-slate-500 font-semibold mt-3">
            No recent order confirmation is available. Please place an order
            first.
          </p>

          <button
            onClick={() => navigate("/shop")}
            className="mt-6 bg-brand-gold hover:opacity-90 text-white px-6 py-4 rounded-xl text-xs font-black uppercase tracking-wider"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-cream-base px-6 py-10 text-left font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="bg-slate-950 rounded-3xl p-8 sm:p-10 text-white shadow-xl mb-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-80 bg-sage-green/100/20 rounded-full blur-3xl" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 px-4 py-2 rounded-full mb-5">
                <CheckCircle2 className="w-4 h-4" />

                <span className="text-xs font-black uppercase tracking-widest">
                  Order Placed Successfully
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black tracking-tight">
                Thank you, {confirmationData.customer_name}
              </h1>

              <p className="text-sm text-slate-300 font-semibold mt-3 max-w-2xl">
                Your order has been placed successfully. Admin will confirm your
                order soon.
              </p>
            </div>

            <div className="bg-white/10 border border-white/10 rounded-2xl p-5 min-w-[260px]">
              <p className="text-[10px] uppercase tracking-widest text-slate-300 font-black">
                Order Code
              </p>

              <p className="text-2xl font-black text-white mt-2">
                {confirmationData.order_code}
              </p>

              <p className="text-xs text-slate-400 font-semibold mt-2">
                {new Date(confirmationData.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6">
          <div className="bg-white border border-brand-border/60 rounded-3xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-sage-green" />

                <h2 className="text-2xl font-black text-brand-dark">
                  Order Items
                </h2>
              </div>

              <p className="text-sm text-slate-500 font-semibold mt-1">
                {confirmationData.items.length} product(s) included in this
                order.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {confirmationData.items.map((item) => (
                <div
                  key={item.id}
                  className="p-5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <img
                      src={getItemImage(item)}
                      alt={item.name}
                      className="w-16 h-20 rounded-xl object-cover bg-cream-card/60 border border-brand-border/60"
                      onError={(event) => {
                        event.currentTarget.src =
                          PLACEHOLDER_IMAGE;
                      }}
                    />

                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-brand-dark line-clamp-1">
                        {item.name}
                      </h3>

                      <p className="text-xs text-slate-500 font-bold mt-1">
                        {item.category || "Wear Right Product"}
                      </p>

                      <p className="text-xs text-slate-400 font-bold mt-1">
                        Quantity: {item.quantity}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-brand-dark">
                      {formatPKR(Number(item.price || 0) * item.quantity)}
                    </p>

                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-black mt-1">
                      {formatPKR(item.price)} each
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-brand-border/60 rounded-3xl shadow-sm p-6">
              <h2 className="text-xl font-black text-brand-dark">
                Customer Details
              </h2>

              <div className="mt-5 space-y-4">
                <InfoLine label="Name" value={confirmationData.customer_name} />
                <InfoLine
                  label="Phone"
                  value={confirmationData.customer_phone}
                />

                <InfoLine
                  label="Email"
                  value={confirmationData.customer_email || "Not provided"}
                />

                <InfoLine
                  label="Payment"
                  value={confirmationData.payment_status}
                />
              </div>

              <div className="mt-5 pt-5 border-t border-slate-100">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Delivery Address
                </p>

                <p className="text-sm font-bold text-slate-800 mt-2 leading-relaxed">
                  {confirmationData.customer_address}
                </p>
              </div>
            </div>

            <div className="bg-white border border-brand-border/60 rounded-3xl shadow-sm p-6">
              <h2 className="text-xl font-black text-brand-dark">
                Payment Summary
              </h2>

              <div className="mt-5 bg-cream-base border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-500">
                  Total Amount
                </span>

                <span className="text-2xl font-black text-brand-dark">
                  {formatPKR(confirmationData.total)}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3">
                <button
                  onClick={() => navigate("/my-orders")}
                  className="w-full bg-slate-950 hover:bg-black text-white py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <ClipboardList className="w-4 h-4" />
                  View My Orders
                </button>

                <button
                  onClick={() => navigate("/shop")}
                  className="w-full bg-brand-gold hover:opacity-90 text-white py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Continue Shopping
                </button>

                <button
                  onClick={() => navigate("/profile")}
                  className="w-full bg-cream-card/60 hover:bg-slate-200 text-slate-700 py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <Home className="w-4 h-4" />
                  View Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400">
        {label}
      </span>

      <span className="text-sm font-black text-brand-dark text-right">
        {value}
      </span>
    </div>
  );
}
