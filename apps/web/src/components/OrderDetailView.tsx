"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import { ordersApi, orderErrorMessage, type ApiOrder } from "@/features/orders/api";
import { notify } from "@/lib/notify";

function formatPKR(value: string | number | undefined) {
  return `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;
}

export default function OrderDetailView({ orderId }: { orderId: string }) {
  const id = orderId;
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await ordersApi.detail<ApiOrder>(id);
      setOrder(data.order);
      setError("");
    } catch (caught) {
      setError(orderErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Load after the first paint so state updates are not synchronously inside the effect.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function cancelOrder() {
    if (!order) return;
    try {
      setCancelling(true);
      const data = await ordersApi.cancel(order.id);
      setOrder(data.order);
      notify("Order cancelled.");
    } catch (caught) {
      notify(orderErrorMessage(caught));
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-slate-500 font-semibold" role="status">
        Loading order...
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-3xl font-black text-brand-dark">Order not available</h1>
        <p className="text-slate-500 font-semibold">{error || "This order could not be found."}</p>
        <Link href="/my-orders" className="bg-brand-gold text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider">
          My orders
        </Link>
      </div>
    );
  }

  const items = order.items || [];
  const canCancel = ["Pending", "Confirmed"].includes(order.order_status);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-cream-base px-4 sm:px-6 py-10 font-sans text-left">
      <div className="max-w-4xl mx-auto">
        <Link href="/my-orders" className="text-xs font-black uppercase tracking-widest text-slate-500">
          ← Back to my orders
        </Link>
        <div className="bg-white border border-brand-border/60 rounded-3xl p-6 sm:p-8 mt-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Order</p>
              <h1 className="text-2xl sm:text-3xl font-black text-brand-dark mt-1">{order.order_code}</h1>
              <p className="text-xs font-semibold text-slate-500 mt-2">
                {new Date(order.order_date).toLocaleString()}
              </p>
            </div>
            <span className="px-4 py-2 rounded-full bg-slate-100 text-xs font-black" data-testid="order-status">
              {order.order_status}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mt-8">
            <div>
              <h2 className="text-sm font-black text-slate-900">Delivery to</h2>
              <p className="text-sm font-semibold text-slate-600 mt-2">{order.customer_name}</p>
              <p className="text-sm text-slate-500 mt-1">{order.customer_phone}</p>
              <p className="text-sm text-slate-500 mt-1">
                {order.customer_address}
                {order.city ? `, ${order.city}` : ""}
              </p>
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Payment</h2>
              <p className="text-sm font-semibold text-slate-600 mt-2">{order.payment_status}</p>
              {order.payment_method === "card_demo" ? (
                <p className="text-xs text-slate-500 mt-1">Demo card — no real payment was taken.</p>
              ) : null}
            </div>
          </div>

          <div className="border-t border-slate-100 mt-6 pt-5">
            <h2 className="text-sm font-black text-slate-900">Items</h2>
            <ul className="divide-y divide-slate-100 mt-2">
              {items.map((item) => (
                <li key={item.id} className="py-3 flex items-center gap-3">
                  <ProductImage
                    src={item.image}
                    alt={item.name}
                    className="w-14 h-16 rounded-lg object-cover bg-slate-100"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-900">{item.name}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      Size {item.size} · Qty {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-black">{formatPKR(item.line_total)}</p>
                </li>
              ))}
            </ul>
            <div className="flex justify-between font-black text-slate-900 border-t border-slate-100 pt-4 mt-2">
              <span>Total</span>
              <span>{formatPKR(order.total_amount)}</span>
            </div>
          </div>

          {canCancel ? (
            <button
              type="button"
              onClick={cancelOrder}
              disabled={cancelling}
              className="mt-6 border border-red-200 text-red-600 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-60"
            >
              {cancelling ? "Cancelling..." : "Cancel order"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
