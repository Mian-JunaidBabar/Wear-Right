"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Banknote, ShieldCheck } from "lucide-react";
import { useCart } from "@/features/cart/useCart";
import { useAuth } from "@/features/auth/AuthProvider";
import { ordersApi, orderErrorMessage, type CheckoutInput } from "@/features/orders/api";
import { lastOrderStore } from "@/features/orders/lastOrder";
import { useNavigate } from "@/lib/navigation";
import { notify } from "@/lib/notify";

function formatPKR(value: string | number | undefined) {
  return `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;
}

export default function CheckoutView() {
  const { user } = useAuth();
  const { cartItems, cartTotal, clearCart, syncing } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customer_name: user.name === "Guest User" ? "" : user.name,
    customer_email: user.email || "",
    customer_phone: "",
    customer_address: "",
    city: "",
    payment_method: "cod" as "cod" | "card_demo",
  });

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.customer_name.trim()) return notify("Please enter your full name.");
    if (!form.customer_phone.trim()) return notify("Please enter your phone number.");
    if (!form.customer_address.trim()) return notify("Please enter your delivery address.");
    if (cartItems.length === 0) return notify("Your cart is empty.");

    try {
      setSubmitting(true);
      const input: CheckoutInput = { ...form, payment_method: form.payment_method };
      const response = await ordersApi.checkout(input);
      const order = response.order;
      lastOrderStore.set({
        order_code: order.order_code,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        customer_address: [order.customer_address, order.city].filter(Boolean).join(", "),
        payment_status: order.payment_status,
        total: Number(order.total_amount || cartTotal),
        created_at: order.order_date || new Date().toISOString(),
        items: (order.items || []).map((item) => ({
          id: item.product ?? item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          image_url: item.image,
        })),
      });
      clearCart();
      notify("Order placed successfully.");
      navigate("/order-confirmation");
    } catch (error) {
      notify(orderErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (syncing) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-slate-500 font-semibold" role="status">
        Loading checkout...
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-3xl font-black text-brand-dark">Nothing to check out</h1>
        <p className="text-slate-500 font-semibold">Your cart is empty.</p>
        <Link href="/shop" className="bg-brand-gold text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider">
          Go to shop
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-cream-base px-4 sm:px-6 py-10 font-sans text-left">
      <form onSubmit={submit} className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-6">
          <div className="bg-white border border-brand-border/60 rounded-3xl p-6">
            <h1 className="text-3xl font-black text-brand-dark">Checkout</h1>
            <p className="text-sm text-slate-500 font-semibold mt-2">Delivery details</p>
            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              <Field label="Full name" value={form.customer_name} onChange={(v) => update("customer_name", v)} required />
              <Field label="Phone" value={form.customer_phone} onChange={(v) => update("customer_phone", v)} required />
              <Field label="Email (optional)" type="email" value={form.customer_email} onChange={(v) => update("customer_email", v)} />
              <Field label="City" value={form.city} onChange={(v) => update("city", v)} />
              <div className="sm:col-span-2">
                <Field label="Delivery address" value={form.customer_address} onChange={(v) => update("customer_address", v)} required />
              </div>
            </div>
          </div>

          <fieldset className="bg-white border border-brand-border/60 rounded-3xl p-6">
            <legend className="text-lg font-black text-brand-dark px-1">Payment</legend>
            <div className="space-y-3 mt-3">
              <PaymentOption
                checked={form.payment_method === "cod"}
                onChange={() => update("payment_method", "cod")}
                icon={<Banknote className="w-5 h-5" />}
                title="Cash on delivery"
                description="Pay in cash when your order arrives."
              />
              <PaymentOption
                checked={form.payment_method === "card_demo"}
                onChange={() => update("payment_method", "card_demo")}
                icon={<CreditCard className="w-5 h-5" />}
                title="Card (demo)"
                description="Demo only — no card number is collected and no payment is taken."
              />
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-500 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> This university project never asks for real card details.
            </p>
          </fieldset>
        </div>

        <aside className="bg-white border border-brand-border/60 rounded-3xl p-6 shadow-sm">
          <h2 className="text-lg font-black text-brand-dark">Your order</h2>
          <ul className="mt-4 space-y-3">
            {cartItems.map((item) => (
              <li key={`${item.product.id}-${item.size || "M"}`} className="flex justify-between gap-3 text-sm">
                <span className="font-semibold text-slate-600">
                  {item.quantity} × {item.product.name}
                  {item.size ? ` (${item.size})` : ""}
                </span>
                <span className="font-black whitespace-nowrap">{formatPKR(Number(item.product.price) * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-100 mt-4 pt-4 flex justify-between font-black text-slate-900">
            <span>Total</span>
            <span>{formatPKR(cartTotal)}</span>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full bg-brand-gold disabled:opacity-60 text-white px-5 py-4 rounded-xl text-xs font-black uppercase tracking-wider"
          >
            {submitting ? "Placing order..." : "Place order"}
          </button>
          <Link href="/cart" className="mt-3 block text-center text-xs font-black uppercase tracking-wider text-slate-500">
            Back to cart
          </Link>
        </aside>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-left">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-brand-gold"
      />
    </label>
  );
}

function PaymentOption({
  checked,
  onChange,
  icon,
  title,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <label className={`flex items-start gap-3 border rounded-xl p-4 cursor-pointer ${checked ? "border-brand-gold bg-amber-50/50" : "border-slate-200"}`}>
      <input type="radio" checked={checked} onChange={onChange} className="mt-1" name="payment_method" />
      <span className="text-slate-700 mt-0.5">{icon}</span>
      <span>
        <span className="block text-sm font-black text-slate-900">{title}</span>
        <span className="block text-xs font-semibold text-slate-500 mt-1">{description}</span>
      </span>
    </label>
  );
}
