"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, RotateCcw, Shirt, Shuffle, ShoppingBag } from "lucide-react";
import ProductImage from "@/components/ProductImage";
import { useCart } from "@/features/cart/useCart";
import type { CartProduct } from "@/features/cart/types";
import { useOptionalAuth } from "@/features/auth/AuthProvider";
import { useNavigate, useSearchParams } from "@/lib/navigation";
import {
  mannequinApi,
  type AlphaGender,
  type AlphaItem,
  type AlphaSkin,
  type AlphaSlot,
  type AlphaWardrobe,
} from "@/features/mannequin/api";
import {
  ACCESSORY_SLOTS,
  allImageUrls,
  availableSkins,
  baseImage,
  buyableItems,
  canBuy,
  defaultOutfit,
  defaultSize,
  layerStack,
  outfitTotal,
  pickerGroups,
  shuffleOutfit,
  skinFromContrast,
  toggleItem,
  wornItems,
  type Outfit,
} from "@/features/mannequin/dressingRoom";

type LoadState =
  | { status: "loading"; gender: AlphaGender }
  | { status: "ready"; gender: AlphaGender; wardrobe: AlphaWardrobe }
  | { status: "error"; gender: AlphaGender };

const SKIN_LABELS: Record<AlphaSkin, string> = { fair: "Fair", wheatish: "Wheatish", dark: "Dark" };
const GENDERS: Array<{ value: AlphaGender; label: string }> = [
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
];

function formatPKR(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-PK")}`;
}

function asGender(value: string | null | undefined): AlphaGender | null {
  return value === "men" || value === "women" ? value : null;
}

function asSkin(value: string | null | undefined): AlphaSkin | null {
  return value === "fair" || value === "wheatish" || value === "dark" ? value : null;
}

function toCartProduct(item: AlphaItem, size?: string): CartProduct {
  return {
    id: item.product_id,
    name: item.name,
    category: item.category || "Wear Right Product",
    color: item.color || "",
    image: item.image,
    image_url: item.image,
    price: item.price,
    stock_quantity: item.stock_quantity,
    status: item.status || "Active",
    sizes: item.sizes,
    size,
  };
}

/**
 * Mannequin (alpha): one AI-generated model photo per gender (in three skin tones) and a garment layer per
 * product, stacked in the browser, so the shopper can try any shirt or kurta with any bottom, shoes and
 * any mix of accessories, see the whole outfit, and put it in the cart.
 */
export default function DressingRoomView() {
  const [params] = useSearchParams();
  const auth = useOptionalAuth();
  const focus = Number(params.get("product")) || null;
  const profileGender = (auth?.profile as { gender?: string } | null | undefined)?.gender;
  const initialGender = asGender(params.get("gender")) ?? (profileGender === "female" ? "women" : "men");
  const [gender, setGender] = useState<AlphaGender>(initialGender);
  const [state, setState] = useState<LoadState>({ status: "loading", gender: initialGender });

  useEffect(() => {
    let cancelled = false;
    mannequinApi
      .wardrobe(gender)
      .then((wardrobe) => {
        if (!cancelled) setState({ status: "ready", gender, wardrobe });
      })
      .catch((error) => {
        console.error("Mannequin wardrobe error:", error);
        if (!cancelled) setState({ status: "error", gender });
      });
    return () => {
      cancelled = true;
    };
  }, [gender]);

  const switcher = (
    <div role="group" aria-label="Mannequin" className="inline-flex rounded-xl border border-brand-border bg-white p-1">
      {GENDERS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={gender === option.value}
          data-testid={`mannequin-gender-${option.value}`}
          onClick={() => setGender(option.value)}
          className={`rounded-lg px-4 py-1.5 text-xs font-black uppercase tracking-wider ${
            gender === option.value ? "bg-brand-dark text-white" : "text-slate-500 hover:text-brand-dark"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  if (state.status === "loading" || state.gender !== gender) {
    return (
      <main className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        {switcher}
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" aria-label="Loading the mannequin" />
      </main>
    );
  }

  if (state.status === "error" || !state.wardrobe.base || state.wardrobe.slots.length === 0) {
    return (
      <main className="min-h-[70vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
        {switcher}
        <Shirt className="mt-4 w-10 h-10 text-slate-300" />
        <h1 className="text-xl font-black text-brand-dark">Mannequin preview is coming soon</h1>
        <p className="max-w-md text-sm font-semibold text-slate-500">
          {state.status === "error"
            ? "We could not load the mannequin right now. Please try again in a moment."
            : `No ${gender === "women" ? "women's" : "men's"} products are on the mannequin yet.`}
        </p>
      </main>
    );
  }

  const preferredSkin = asSkin(params.get("skin")) ?? skinFromContrast(auth?.user.contrastType);
  return (
    <DressingRoom
      key={`${gender}-${focus ?? "none"}`}
      wardrobe={state.wardrobe}
      focus={focus}
      preferredSkin={preferredSkin}
      switcher={switcher}
    />
  );
}

function DressingRoom({
  wardrobe,
  focus,
  preferredSkin,
  switcher,
}: {
  wardrobe: AlphaWardrobe;
  focus: number | null;
  preferredSkin: AlphaSkin;
  switcher: ReactNode;
}) {
  const navigate = useNavigate();
  const { addToCart, addToCartAsync } = useCart();
  const [adding, setAdding] = useState(false);
  const skins = useMemo(() => availableSkins(wardrobe), [wardrobe]);
  const [skin, setSkin] = useState<AlphaSkin>(skins.includes(preferredSkin) ? preferredSkin : "wheatish");
  const [outfit, setOutfit] = useState<Outfit>(() => defaultOutfit(wardrobe, focus));
  const [sizes, setSizes] = useState<Record<number, string>>({});
  const base = wardrobe.base!;

  // Load every layer for this skin once, up front, so picking a different shirt swaps instantly.
  useEffect(() => {
    for (const url of allImageUrls(wardrobe, skin)) {
      const image = new Image();
      image.src = url;
    }
  }, [wardrobe, skin]);

  const layers = useMemo(() => layerStack(wardrobe, outfit, skin), [wardrobe, outfit, skin]);
  const worn = useMemo(() => wornItems(wardrobe, outfit), [wardrobe, outfit]);
  const buyable = useMemo(() => buyableItems(wardrobe, outfit), [wardrobe, outfit]);
  const total = useMemo(() => outfitTotal(wardrobe, outfit), [wardrobe, outfit]);
  const groups = useMemo(() => pickerGroups(wardrobe), [wardrobe]);

  const pick = (slot: AlphaSlot, productId: number) => setOutfit((current) => toggleItem(wardrobe, current, slot, productId));
  const sizeOf = (item: AlphaItem) => sizes[item.product_id] ?? defaultSize(item);
  const addOne = (item: AlphaItem) => addToCart(toCartProduct(item, sizeOf(item)));
  // One at a time: the signed-in cart applies only the latest server reply, so parallel adds could race.
  const addOutfit = async () => {
    setAdding(true);
    try {
      for (const { item } of buyable) await addToCartAsync(toCartProduct(item, sizeOf(item)));
    } finally {
      setAdding(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
      <header className="mb-6 lg:mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-brand-gold">Mannequin · alpha</p>
          <h1 className="mt-1 text-2xl lg:text-3xl font-black text-brand-dark">Try outfits on the mannequin</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500">
            Pick a shirt or kurta, a bottom, shoes and any accessories and see them together. Pick an item again to
            take it off.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {switcher}
          <div role="group" aria-label="Skin tone" className="inline-flex rounded-xl border border-brand-border bg-white p-1">
            {(["fair", "wheatish", "dark"] as AlphaSkin[]).map((option) => {
              const offered = skins.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  disabled={!offered}
                  aria-pressed={skin === option}
                  data-testid={`mannequin-skin-${option}`}
                  title={offered ? `${SKIN_LABELS[option]} skin` : `${SKIN_LABELS[option]} skin is not ready yet`}
                  onClick={() => setSkin(option)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40 ${
                    skin === option ? "bg-brand-gold text-white" : "text-slate-500 hover:text-brand-dark"
                  }`}
                >
                  {SKIN_LABELS[option]}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] gap-6 lg:gap-10 items-start">
        <section className="lg:sticky lg:top-28">
          <div
            data-testid="mannequin-stage"
            data-skin={skin}
            className="relative mx-auto w-full max-w-sm lg:max-w-none overflow-hidden rounded-3xl border border-brand-border/60 bg-slate-100 shadow-sm"
            style={{ aspectRatio: `${base.width} / ${base.height}` }}
          >
            <img
              src={baseImage(wardrobe, skin) ?? base.image}
              alt={`${base.label} wearing the selected outfit`}
              className="absolute inset-0 h-full w-full object-contain"
            />
            {layers.map((layer) => (
              <img
                key={layer.key}
                src={layer.src}
                alt=""
                aria-hidden="true"
                data-testid="mannequin-layer"
                data-layer={layer.key}
                className="absolute inset-0 h-full w-full object-contain"
                style={{ zIndex: layer.z }}
              />
            ))}
            <span className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 shadow-sm">
              Alpha · {base.label}
            </span>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setOutfit(shuffleOutfit(wardrobe))}
              className="flex-1 rounded-xl bg-brand-dark py-3 text-xs font-black uppercase tracking-wider text-white flex items-center justify-center gap-2 hover:opacity-90"
            >
              <Shuffle className="w-4 h-4" /> Shuffle
            </button>
            <button
              type="button"
              onClick={() => setOutfit(defaultOutfit(wardrobe, focus))}
              className="flex-1 rounded-xl border border-brand-border bg-white py-3 text-xs font-black uppercase tracking-wider text-brand-dark flex items-center justify-center gap-2 hover:bg-slate-50"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </div>
        </section>

        <section className="min-w-0 space-y-8">
          {groups.map((group) => (
            <div key={group.key} data-testid={`mannequin-group-${group.key}`} className="space-y-4">
              <h2 className="text-sm font-black text-brand-dark">
                {group.label}
                {group.key === "accessories" && (
                  <span className="ml-2 text-xs font-semibold text-slate-400">wear any of these together</span>
                )}
                {group.key === "clothes" && (
                  <span className="ml-2 text-xs font-semibold text-slate-400">a kurta replaces the shirt</span>
                )}
              </h2>
              {group.rows.map((row) => (
                <div key={row.slot}>
                  <h3 className="mb-2 text-[11px] font-black uppercase tracking-widest text-slate-500">{row.label}</h3>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {row.items.map((item) => {
                      const selected = outfit[row.slot] === item.product_id;
                      return (
                        <button
                          key={item.product_id}
                          type="button"
                          aria-pressed={selected}
                          data-testid="mannequin-option"
                          data-slot={row.slot}
                          onClick={() => pick(row.slot, item.product_id)}
                          className={`w-32 shrink-0 rounded-2xl border bg-white p-2 text-left transition-all ${
                            selected ? "border-brand-gold ring-2 ring-brand-gold" : "border-brand-border/60 hover:border-brand-gold/60"
                          }`}
                        >
                          <ProductImage src={item.image} alt={item.name} className="h-28 w-full rounded-xl bg-slate-50" />
                          <p className="mt-2 line-clamp-2 text-xs font-bold text-brand-dark">{item.name}</p>
                          <p className="mt-1 text-xs font-black text-slate-500">{formatPKR(item.price)}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div className="rounded-3xl border border-brand-border/60 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black text-brand-dark">You are wearing</h2>
            {worn.length === 0 ? (
              <p className="mt-2 text-sm font-semibold text-slate-500">Nothing yet. Pick something above.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {worn.map(({ slot, label, item }) => (
                  <li key={slot} data-testid="mannequin-worn" className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {label}
                        {ACCESSORY_SLOTS.includes(slot) ? " · accessory" : ""}
                      </p>
                      <button
                        type="button"
                        disabled={!item.available}
                        onClick={() => navigate(`/product/${item.product_id}`)}
                        className="truncate text-left text-sm font-bold text-brand-dark enabled:hover:underline disabled:cursor-default"
                      >
                        {item.name}
                      </button>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-black text-brand-dark">{formatPKR(item.price)}</span>
                      {canBuy(item) ? (
                        <>
                          {(item.sizes?.length ?? 0) > 0 && (
                            <select
                              aria-label={`Size for ${item.name}`}
                              value={sizeOf(item)}
                              onChange={(event) => setSizes((current) => ({ ...current, [item.product_id]: event.target.value }))}
                              className="rounded-lg border border-brand-border bg-white px-2 py-1 text-xs font-bold"
                            >
                              {item.sizes!.map((size) => (
                                <option key={size} value={size}>
                                  {size}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            type="button"
                            data-testid="mannequin-add-item"
                            onClick={() => addOne(item)}
                            className="rounded-lg bg-brand-gold px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white hover:opacity-90"
                          >
                            Add to cart
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {item.available ? "Out of stock" : "Not for sale yet"}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Outfit total</p>
              <p data-testid="mannequin-total" className="text-lg font-black text-brand-dark">{formatPKR(total)}</p>
            </div>
            <button
              type="button"
              data-testid="mannequin-add-outfit"
              disabled={buyable.length === 0 || adding}
              onClick={() => void addOutfit()}
              className="mt-4 w-full rounded-xl bg-brand-dark py-3 text-xs font-black uppercase tracking-wider text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
              {buyable.length === worn.length || buyable.length === 0
                ? "Add outfit to cart"
                : `Add ${buyable.length} of ${worn.length} items to cart`}
            </button>
          </div>

          <p className="text-xs font-semibold text-slate-400">
            Alpha preview for selected products. The model photos and garment images are AI-generated from our product
            photos.
          </p>
        </section>
      </div>
    </main>
  );
}
