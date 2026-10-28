"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  CalendarCheck,
  ScanFace,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  RefreshCcw,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Tags,
  Palette,
  Sparkles,
  Users,
  Settings,
  Eye,
  ArrowLeft,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink,
} from "lucide-react";
import { PLACEHOLDER_IMAGE } from "@/lib/config";
import { ApiError } from "@/lib/api";
import type { ApiCategory, ApiStyle } from "@/features/catalog/api";
import AdminTaxonomy from "@/components/AdminTaxonomy";
import SettingsSection from "@/components/admin/SettingsSection";
import TeamSection from "@/components/admin/TeamSection";
import ToneRulesPanel from "@/components/admin/ToneRulesPanel";
import { useNavigate, usePathname } from "@/lib/navigation";
import { useAdminAuth } from "@/features/admin/AdminAuthProvider";
import { adminApi } from "@/features/admin/api";
import { ADMIN_SECTIONS, sectionFromPath, type AdminSectionId } from "@/features/admin/sections";
import { notify } from "@/lib/notify";

type DashboardData = {
  total_products: number;
  total_orders: number;
  total_bookings: number;
  total_face_scans: number;
  monthly_revenue: number;
  monthly_profit: number;
  low_stock_products: number;
  style_counts: Record<string, number>;
  skin_tone_counts: Record<string, number>;
};

type Product = {
  id: number;
  name: string;
  category: string;
  cultural_tag: string;
  compatible_skin_tone: string;
  color?: string;
  garment_type?: string;
  /** What the garment actually is ("shirt", "kurta", ... from catalog kinds); the server cores it when blank. */
  kind?: string | null;
  /** Which shop section the row belongs to: men / women / unisex ("" until guessed). */
  gender?: string | null;
  /** Outfit slot the row covers ("top", "bottom", ...); read-only, derived by the server. */
  slot?: string | null;
  image?: string | null;
  image_url?: string | null;
  cost_price: string | number;
  price: string | number;
  profit_per_item?: string | number;
  stock_quantity: number;
  size_s_stock: number;
  size_m_stock: number;
  size_l_stock: number;
  size_xl_stock: number;
  size_xxl_stock: number;
  status: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
};

type OrderItem = {
  id: number;
  product: number | null;
  name: string;
  price: string | number;
  size: string;
  quantity: number;
  line_total: string | number;
  image: string | null;
};

type Order = {
  id: number;
  order_code?: string | null;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  city?: string;
  /** Legacy single-product orders only; checkout orders list their products in `items`. */
  product: number | null;
  product_name?: string | null;
  quantity: number;
  total_amount: string | number;
  profit_amount: string | number;
  order_status: string;
  payment_status: string;
  order_date: string;
  items?: OrderItem[];
};

type OrderLine = {
  key: string;
  name: string;
  productId: number | null;
  price: string | number;
  quantity: number;
  size: string;
  total: string | number;
  image: string | null;
};

/** One shape for both order kinds: checkout orders (with items) and legacy single-product orders. */
function orderLines(order: Order): OrderLine[] {
  if (order.items && order.items.length > 0) {
    return order.items.map((item) => ({
      key: `item-${item.id}`,
      name: item.name,
      productId: item.product,
      price: item.price,
      quantity: item.quantity,
      size: item.size,
      total: item.line_total,
      image: item.image,
    }));
  }
  const quantity = Number(order.quantity || 0);
  return [
    {
      key: `order-${order.id}`,
      name: order.product_name || "Product removed",
      productId: order.product,
      price: quantity > 0 ? Number(order.total_amount || 0) / quantity : order.total_amount,
      quantity,
      size: "",
      total: order.total_amount,
      image: null,
    },
  ];
}

type Booking = {
  id: number;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  product_name?: string;
  booking_type: string;
  booking_date: string;
  status: string;
  created_at: string;
};

type FaceScanRecord = {
  id: number;
  username?: string;
  visitor_name?: string;
  detected_skin_tone: string;
  confidence_score: number;
  lighting_quality?: string;
  brightness: number;
  scan_date: string;
};

const skinTones = ["Fair", "Medium", "Dark"];
const statuses = ["Active", "Inactive", "Out of Stock"];

const colors = [
  "White",
  "Black",
  "Navy Blue",
  "Beige",
  "Grey",
  "Charcoal Grey",
  "Tan",
  "Brown",
  "Dark Brown",
  "Sky Blue",
  "Royal Blue",
  "Maroon",
  "Wine Red",
  "Emerald Green",
  "Deep Purple",
  "Bottle Green",
  "Burgundy",
  "Pastel Pink",
  "Soft Lavender",
  "Light Grey",
  "Denim Blue",
  "Mustard Yellow",
  "Olive Green",
  "Rust Orange",
  "Teal",
  "Coral",
  "Camel",
  "Off-White",
  "Peach",
  "Turquoise",
  "Khaki",
  "Light Olive",
  "Deep Teal",
  "Bright Yellow",
  "Fuchsia Pink",
  "Orange",
  "Bright Red",
  "Cobalt Blue",
  "Yellow",
  "Fuchsia",
  "Bright Orange",
  "Hot Pink",
  "Lemon Yellow",
  "Cream",
  "Charcoal",
];

// What garments exist, mirroring apps/server/catalog/engine/kinds.py KIND_GROUPS. The option
// label adds the group ("Top — shirt") since flat kind ids are lowercase words.
const KIND_GROUPS_UI: Array<[string, string[]]> = [
  ["Top", ["tshirt", "shirt", "polo", "kurta", "kameez"]],
  ["Outerwear", ["jacket", "blazer", "waistcoat", "hoodie"]],
  ["Bottom", ["jeans", "trousers", "shorts", "shalwar"]],
  ["Footwear", ["sneakers", "formal_shoes", "sandals", "boots"]],
  ["Accessory", ["watch", "belt", "tie", "cap", "sunglasses", "bag"]],
  ["Women", ["dupatta", "dress"]],
];
const kindOptions = KIND_GROUPS_UI.flatMap(([group, kinds]) => kinds.map((kind) => `${group} — ${kind}`));
const kindValue = (option: string) => option.split(" — ")[1] ?? "";
/** Readable label like "Top — shirt" for a kind id ("shirt"). */
const kindLabel = (kind: string) =>
  KIND_GROUPS_UI.flatMap(([, kinds]) => kinds).includes(kind) // eslint-disable-line no-shadow -- covered above
    ? (KIND_GROUPS_UI.find(([, kinds]) => kinds.includes(kind))?.[0] ?? "") + " — " + kind
    : kind;

const shopSections = ["men", "women", "unisex"];

const emptyProductForm = {
  name: "",
  category: "Men Shirt",
  cultural_tag: "Formal",
  compatible_skin_tone: "Medium",
  color: "White",
  garment_type: "Top",
  kind: "",
  gender: "",
  cost_price: "0",
  price: "",
  stock_quantity: "0",
  size_s_stock: "0",
  size_m_stock: "0",
  size_l_stock: "0",
  size_xl_stock: "0",
  size_xxl_stock: "0",
  status: "Active",
  description: "",
  is_active: true,
};

function formatPKR(value: string | number | undefined) {
  const num = Number(value || 0);
  return `Rs. ${num.toLocaleString("en-PK")}`;
}

function getImage(product: Product) {
  return product.image_url || product.image || PLACEHOLDER_IMAGE;
}

/** One readable line from a DRF error body such as {category: ["Unknown category..."]}. */
function describeApiErrors(details: unknown): string {
  if (!details || typeof details !== "object") return "check the fields and try again.";
  const body = (details as { errors?: unknown }).errors ?? details;
  if (!body || typeof body !== "object") return "check the fields and try again.";
  return Object.entries(body as Record<string, unknown>)
    .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(" ") : String(messages)}`)
    .join(" ");
}

const SIDEBAR_KEY = "wr-admin-sidebar-collapsed";

const SECTION_ICONS: Record<AdminSectionId, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  products: Package,
  styles: Tags,
  skinTone: Palette,
  outfitRules: Sparkles,
  orders: ShoppingCart,
  bookings: CalendarCheck,
  faceScans: ScanFace,
  team: Users,
  settings: Settings,
};

/** Order statuses an admin may move to from each status (mirrors orders/services.py ALLOWED_TRANSITIONS). */
const NEXT_ORDER_STATUSES: Record<string, string[]> = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Shipped", "Cancelled"],
  Shipped: ["Delivered"],
  Delivered: [],
  Cancelled: [],
};

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function AdminView() {
  const { session, logout, can } = useAdminAuth();
  const navigate = useNavigate();
  const pathname = usePathname();
  const section: AdminSectionId | null = sectionFromPath(pathname);
  const activeTab = section;

  const onLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  const visibleSections = ADMIN_SECTIONS.filter((item) => item.permission === null || can(item.permission));
  const allowed = section !== null && visibleSections.some((item) => item.id === section);

  // Collapsible sidebar: remembered per browser. On small screens it is a drawer instead.
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved preference once after mount (no localStorage on the server)
    setCollapsed(readCollapsed());
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        // storage unavailable: the toggle still works for this visit
      }
      return next;
    });
  };

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryRows, setCategoryRows] = useState<ApiCategory[]>([]);
  const [styleRows, setStyleRows] = useState<ApiStyle[]>([]);
  const categories = categoryRows.filter((row) => row.is_active).map((row) => row.name);
  const styles = styleRows.filter((row) => row.is_active).map((row) => row.name);
  const [orders, setOrders] = useState<Order[]>([]);

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? null;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [faceScans, setFaceScans] = useState<FaceScanRecord[]>([]);

  const [searchVal, setSearchVal] = useState("");
  const [loading, setLoading] = useState(true);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState("");
  const [suggestingColour, setSuggestingColour] = useState(false);

  const canProducts = can("products.view");
  const manageProducts = can("products.manage");
  const manageOrders = can("orders.manage");
  const manageBookings = can("bookings.manage");

  const fetchAllData = async () => {
    // Only ask for what this role may see, so a limited role never triggers 403s.
    const tasks: Array<Promise<unknown>> = [];
    if (can("dashboard.view")) tasks.push(adminApi.dashboard<{ dashboard: DashboardData }>().then((d) => setDashboard(d.dashboard)));
    if (canProducts) {
      tasks.push(adminApi.products<{ products?: Product[] }>().then((d) => setProducts(d.products || [])));
      tasks.push(adminApi.categories().then((d) => setCategoryRows(d.categories)));
      tasks.push(adminApi.styles().then((d) => setStyleRows(d.styles)));
    }
    if (can("orders.view")) tasks.push(adminApi.orders<{ orders?: Order[] }>().then((d) => setOrders(d.orders || [])));
    if (can("bookings.view")) tasks.push(adminApi.bookings<{ bookings?: Booking[] }>().then((d) => setBookings(d.bookings || [])));
    if (can("scans.view")) {
      tasks.push(adminApi.faceScans<{ face_scan_records?: FaceScanRecord[] }>().then((d) => setFaceScans(d.face_scan_records || [])));
    }
    const results = await Promise.allSettled(tasks);
    if (results.some((result) => result.status === "rejected")) {
      console.error(results.filter((result) => result.status === "rejected"));
      notify("Some admin data could not be loaded. Check that the server is running.", "error");
    }
    setLoading(false);
  };

  const loadAllData = async () => {
    setLoading(true);
    await fetchAllData();
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: state is set after the request resolves
    void fetchAllData();
    // Permissions are fixed for the life of the session; reload when the admin changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  const filteredProducts = useMemo(() => {
    const lower = searchVal.toLowerCase().trim();

    if (!lower) return products;

    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(lower) ||
        product.category.toLowerCase().includes(lower) ||
        product.cultural_tag.toLowerCase().includes(lower) ||
        product.compatible_skin_tone.toLowerCase().includes(lower)
      );
    });
  }, [products, searchVal]);

  const openAddProductModal = () => {
    setEditingProduct(null);
    setProductForm({ ...emptyProductForm, category: categories[0] || "", cultural_tag: styles[0] || "" });
    setProductImage(null);
    setProductImagePreview("");
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      category: product.category,
      cultural_tag: product.cultural_tag,
      compatible_skin_tone: product.compatible_skin_tone || "All",
      // Keep blanks blank: the old form filled them with White / Top and saved that over the real value.
      color: product.color || "",
      garment_type: product.garment_type || "",
      kind: product.kind || "",
      gender: product.gender || "",
      cost_price: String(product.cost_price),
      price: String(product.price),
      stock_quantity: String(product.stock_quantity),
      size_s_stock: String(product.size_s_stock || 0),
      size_m_stock: String(product.size_m_stock || 0),
      size_l_stock: String(product.size_l_stock || 0),
      size_xl_stock: String(product.size_xl_stock || 0),
      size_xxl_stock: String(product.size_xxl_stock || 0),
      status: product.status,
      description: product.description || "",
      is_active: product.is_active !== false,
    });
    setProductImage(null);
    setProductImagePreview(getImage(product));
    setIsProductModalOpen(true);
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
    setProductForm(emptyProductForm);
    setProductImage(null);
    setProductImagePreview("");
  };

  const sizeTotal =
    Number(productForm.size_s_stock || 0) +
    Number(productForm.size_m_stock || 0) +
    Number(productForm.size_l_stock || 0) +
    Number(productForm.size_xl_stock || 0) +
    Number(productForm.size_xxl_stock || 0);

  const handleProductSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!productForm.name || !productForm.price) {
      notify("Product name and selling price are required.");
      return;
    }

    const formData = new FormData();

    formData.append("name", productForm.name);
    formData.append("category", productForm.category);
    formData.append("cultural_tag", productForm.cultural_tag);
    formData.append("compatible_skin_tone", productForm.compatible_skin_tone);
    // Blank colour / garment type are sent as empty, which the API stores as "not set".
    formData.append("color", productForm.color);
    formData.append("garment_type", productForm.garment_type);
    // Kind is what the garment actually is; the server guesses it when left blank.
    formData.append("kind", productForm.kind);
    // Shop section (men / women / unisex); blank lets the server take it from the category.
    formData.append("gender", productForm.gender);
    formData.append("cost_price", productForm.cost_price || "0");
    formData.append("price", productForm.price);
    // With per-size stock the total is their sum; products without sizes (watches, caps) keep a plain total.
    formData.append("stock_quantity", String(sizeTotal > 0 ? sizeTotal : Number(productForm.stock_quantity || 0)));
    formData.append("size_s_stock", productForm.size_s_stock || "0");
    formData.append("size_m_stock", productForm.size_m_stock || "0");
    formData.append("size_l_stock", productForm.size_l_stock || "0");
    formData.append("size_xl_stock", productForm.size_xl_stock || "0");
    formData.append("size_xxl_stock", productForm.size_xxl_stock || "0");
    formData.append("status", productForm.status);
    formData.append("description", productForm.description);
    formData.append("is_active", String(productForm.is_active));

    if (productImage) {
      formData.append("image", productImage);
    }

    try {
      await adminApi.saveProduct(editingProduct ? editingProduct.id : null, formData);

      closeProductModal();
      notify(editingProduct ? "Product saved." : "Product added.");
      await loadAllData();
    } catch (error) {
      console.error(error);
      notify(
        error instanceof ApiError && error.status === 400
          ? `The product was not saved: ${describeApiErrors(error.details)}`
          : errorText(error, "The product could not be saved. Please try again."),
        "error",
      );
    }
  };

  const handleImageChange = (file: File | null) => {
    setProductImage(file);
    setProductImagePreview(file ? URL.createObjectURL(file) : editingProduct ? getImage(editingProduct) : "");
  };

  const suggestColour = async () => {
    if (!productImage) {
      notify("Choose a product image first, then ask for a colour suggestion.");
      return;
    }
    try {
      setSuggestingColour(true);
      const response = await adminApi.colourSuggestion(productImage);
      const suggestion = response.suggestion;
      setProductForm((current) => ({ ...current, color: suggestion.name }));
      notify(`Suggested colour: ${suggestion.name} (${suggestion.hex}).`);
    } catch (error) {
      console.error(error);
      notify("Could not read a colour from that image.", "error");
    } finally {
      setSuggestingColour(false);
    }
  };

  const toggleProductActive = async (product: Product) => {
    const formData = new FormData();
    formData.append("is_active", String(product.is_active === false));
    try {
      await adminApi.saveProduct(product.id, formData);
      await loadAllData();
      notify(product.is_active === false ? "Product is visible in the shop." : "Product hidden from the shop.");
    } catch (error) {
      console.error(error);
      notify(errorText(error, "Could not change product visibility."), "error");
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

    try {
      await adminApi.deleteProduct(product.id);
      notify("Product deleted.");
      await loadAllData();
    } catch (error) {
      console.error(error);
      notify(errorText(error, "Could not delete. Please try again."), "error");
    }
  };

  const updateBookingStatus = async (bookingId: number, newStatus: string) => {
    try {
      await adminApi.updateBooking(bookingId, { status: newStatus });
      notify(`Booking ${newStatus.toLowerCase()}.`, "success");
      await loadAllData();
    } catch (error) {
      console.error(error);
      notify(errorText(error, "Could not update the booking status. Please try again."), "error");
    }
  };

  const deleteBooking = async (bookingId: number) => {
    if (!window.confirm(`Delete booking #${bookingId}?`)) return;

    try {
      await adminApi.deleteBooking(bookingId);
      notify("Booking deleted.");
      await loadAllData();
    } catch (error) {
      console.error(error);
      notify(errorText(error, "Could not delete the booking. Please try again."), "error");
    }
  };

  const updateOrderStatus = async (orderId: number, newStatus: string) => {
    try {
      await adminApi.updateOrderStatus(orderId, newStatus);
      notify(`Order moved to ${newStatus}.`, "success");
      await loadAllData();
    } catch (error) {
      console.error(error);
      notify(errorText(error, "Could not update the order status."), "error");
    }
  };

  const deleteOrder = async (order: Order) => {
    const open = order.order_status === "Pending" || order.order_status === "Confirmed";
    const message = open
      ? `Delete order ${order.order_code || `#${order.id}`}? It is still open, so its items go back into stock first.`
      : `Delete order ${order.order_code || `#${order.id}`}? This cannot be undone.`;
    if (!window.confirm(message)) return;

    try {
      await adminApi.deleteOrder(order.id);
      if (selectedOrderId === order.id) setSelectedOrderId(null);
      notify("Order deleted.");
      await loadAllData();
    } catch (error) {
      console.error(error);
      notify(errorText(error, "Could not delete the order. Please try again."), "error");
    }
  };

  const goTo = (path: string) => {
    setSelectedOrderId(null);
    setDrawerOpen(false);
    navigate(path);
  };

  const sidebar = (isDrawer: boolean) => {
    const narrow = collapsed && !isDrawer;
    return (
      <>
        <div className={`border-b border-slate-100 ${narrow ? "px-3 py-5" : "px-6 py-6"}`}>
          <div className={`flex items-center ${narrow ? "justify-center" : "gap-3"}`}>
            <div className="w-11 h-11 shrink-0 rounded-xl bg-white border border-brand-border/60 shadow-sm flex items-center justify-center overflow-hidden">
              <img
                src="/brand/wr-icon.png"
                alt="Wear Right"
                className="w-10 h-10 object-contain"
                onError={(event) => {
                  event.currentTarget.src = "/brand/wr-monogram.png";
                }}
              />
            </div>
            {!narrow && (
              <div className="min-w-0">
                <h1 className="text-lg font-black text-brand-dark leading-tight">Wear Right</h1>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Admin Panel</p>
              </div>
            )}
            {isDrawer && (
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="ml-auto p-2 rounded-lg hover:bg-cream-base">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <nav className={`flex-1 overflow-y-auto space-y-1 ${narrow ? "p-2" : "p-4"}`} aria-label="Admin sections">
          {visibleSections.map((item) => {
            const Icon = SECTION_ICONS[item.id];
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={narrow ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
                onClick={() => goTo(item.path)}
                className={`w-full flex items-center rounded-xl text-sm font-bold transition-all ${
                  narrow ? "justify-center p-3" : "gap-3 px-4 py-3"
                } ${isActive ? "bg-sage-green/10 text-sage-green" : "text-slate-500 hover:bg-cream-base hover:text-brand-dark"}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!narrow && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className={`border-t border-slate-100 space-y-2 ${narrow ? "p-2" : "p-4"}`}>
          <button
            type="button"
            onClick={loadAllData}
            title="Refresh data"
            className={`w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wider ${narrow ? "p-3" : "px-4 py-3"}`}
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {!narrow && "Refresh data"}
          </button>
          {!isDrawer && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`w-full flex items-center justify-center gap-2 rounded-xl border border-brand-border/60 text-slate-500 hover:text-brand-dark hover:bg-cream-base text-xs font-bold uppercase tracking-wider ${narrow ? "p-3" : "px-4 py-2.5"}`}
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              {!narrow && "Collapse"}
            </button>
          )}
        </div>
      </>
    );
  };

  const currentLabel = selectedOrder
    ? `Order ${selectedOrder.order_code || `#${selectedOrder.id}`}`
    : ADMIN_SECTIONS.find((item) => item.id === section)?.label ?? "Not found";

  return (
    <div className="min-h-screen bg-cream-base text-left font-sans">
      <div className="flex min-h-screen">
        <aside
          className={`hidden lg:flex flex-col bg-white border-r border-brand-border/60 sticky top-0 h-screen transition-[width] duration-200 ${
            collapsed ? "w-20" : "w-72"
          }`}
        >
          {sidebar(false)}
        </aside>

        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-slate-950/40" onClick={() => setDrawerOpen(false)} />
            <aside className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col shadow-2xl">{sidebar(true)}</aside>
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-brand-border/60 px-4 sm:px-8 h-16 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 rounded-lg border border-brand-border/60 text-slate-600"
            >
              <Menu className="w-5 h-5" />
            </button>
            <p className="text-sm font-black text-brand-dark truncate">{currentLabel}</p>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <Link
                href="/"
                target="_blank"
                className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-dark px-3 py-2 rounded-lg hover:bg-cream-base"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View shop
              </Link>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-brand-dark leading-tight">{session?.user.name}</p>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{session?.role.name}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-sage-green/10 text-sage-green flex items-center justify-center font-black">
                {(session?.user.name || "A").charAt(0).toUpperCase()}
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Sign out"
                aria-label="Sign out"
                className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

        <main className="flex-1 p-4 sm:p-8 overflow-x-hidden">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-bold text-sage-green uppercase tracking-widest">
                AI Clothing Recommendation System
              </p>

              <h2 className="text-3xl font-black text-brand-dark mt-1">{currentLabel}</h2>
            </div>

            <button
              onClick={loadAllData}
              className="flex items-center justify-center gap-2 bg-white border border-brand-border/60 px-5 py-3 rounded-xl text-sm font-bold text-slate-700 hover:bg-cream-card/60"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </header>

          {section === null && (
            <Panel title="Page not found">
              <p className="text-sm text-slate-500 font-semibold">This admin page does not exist.</p>
            </Panel>
          )}

          {section !== null && !allowed && (
            <div role="alert">
              <Panel title="Not allowed">
                <p className="text-sm text-slate-500 font-semibold">
                  Your role ({session?.role.name}) does not include this section. Ask a Super Admin if you need it.
                </p>
              </Panel>
            </div>
          )}

          {allowed && activeTab === "dashboard" && (
            <section className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                <MetricCard
                  title="Total Products"
                  value={dashboard?.total_products || 0}
                  icon={<Package className="w-5 h-5" />}
                  note="Catalog items"
                />

                <MetricCard
                  title="Total Orders"
                  value={dashboard?.total_orders || 0}
                  icon={<ShoppingCart className="w-5 h-5" />}
                  note="Customer orders"
                />

                <MetricCard
                  title="Monthly Revenue"
                  value={formatPKR(dashboard?.monthly_revenue || 0)}
                  icon={<Wallet className="w-5 h-5" />}
                  note="This month"
                />

                <MetricCard
                  title="Monthly Profit"
                  value={formatPKR(dashboard?.monthly_profit || 0)}
                  icon={<TrendingUp className="w-5 h-5" />}
                  note="Estimated profit"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <MetricCard
                  title="Total Bookings"
                  value={dashboard?.total_bookings || 0}
                  icon={<CalendarCheck className="w-5 h-5" />}
                  note="Trial / consultation"
                />

                <MetricCard
                  title="Face Scans"
                  value={dashboard?.total_face_scans || 0}
                  icon={<ScanFace className="w-5 h-5" />}
                  note="Saved scan records"
                />

                <MetricCard
                  title="Low Stock"
                  value={dashboard?.low_stock_products || 0}
                  icon={<AlertTriangle className="w-5 h-5" />}
                  note="Stock quantity 5 or below"
                  warning
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Panel title="Products by Style">
                  <div className="space-y-4">
                    {styles.map((style) => (
                      <ProgressRow
                        key={style}
                        label={style}
                        value={
                          dashboard?.style_counts?.[style] || 0
                        }
                        total={dashboard?.total_products || 1}
                      />
                    ))}
                  </div>
                </Panel>

                <Panel title="Products by Skin Tone">
                  <div className="space-y-4">
                    {[...skinTones, "All"].map((tone) => (
                      <ProgressRow
                        key={tone}
                        label={tone === "All" ? "All tones" : tone}
                        value={dashboard?.skin_tone_counts?.[tone] || 0}
                        total={dashboard?.total_products || 1}
                      />
                    ))}
                  </div>
                </Panel>
              </div>
            </section>
          )}

          {allowed && activeTab === "products" && (
            <section className="bg-white rounded-2xl border border-brand-border/60 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative w-full md:w-96">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

                  <input
                    value={searchVal}
                    onChange={(event) => setSearchVal(event.target.value)}
                    placeholder="Search products..."
                    className="w-full bg-cream-base border border-brand-border/60 rounded-xl py-3 pl-10 pr-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                  />
                </div>

                {manageProducts && (
                  <button
                    onClick={openAddProductModal}
                    className="bg-brand-gold hover:opacity-90 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Product
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1150px] text-sm">
                  <thead className="bg-cream-base border-b border-slate-100">
                    <tr className="text-[11px] uppercase tracking-widest text-slate-400 font-black">
                      <th className="p-4 text-left min-w-[250px] sticky left-0 z-10 bg-cream-base">Product</th>
                      <th className="p-4 text-left min-w-[130px]">Category</th>
                      <th className="p-4 text-left min-w-[100px]">Style</th>
                      <th className="p-4 text-left min-w-[110px]">Skin Tone</th>
                      <th className="p-4 text-left min-w-[100px]">Color</th>
                      <th className="p-4 text-left min-w-[100px]">Cost</th>
                      <th className="p-4 text-left min-w-[100px]">Price</th>
                      <th className="p-4 text-left min-w-[200px]">Stock</th>
                      <th className="p-4 text-left min-w-[100px]">Status</th>
                      <th className="p-4 text-right w-[100px]">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-cream-base">
                        <td className="p-4 sticky left-0 z-10 bg-white">
                          <div className="flex items-center gap-3">
                            <img
                              src={getImage(product)}
                              alt={product.name}
                              className="w-12 h-14 rounded-xl object-cover bg-cream-card/60 border border-brand-border/60"
                            />

                            <div>
                              <p className="font-black text-brand-dark">
                                {product.name}
                              </p>
                              <p className="text-xs text-slate-400 font-bold">
                                ID: {product.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 font-bold text-slate-600">
                          {product.category}
                        </td>

                        <td className="p-4">
                          <Badge>{product.cultural_tag}</Badge>
                        </td>

                        <td className="p-4">
                          <Badge>{product.compatible_skin_tone}</Badge>
                        </td>

                        <td className="p-4 font-bold text-slate-600">
                          {product.color || "N/A"}
                        </td>

                        <td className="p-4 font-bold text-slate-600">
                          {formatPKR(product.cost_price)}
                        </td>

                        <td className="p-4 font-black text-brand-dark">
                          {formatPKR(product.price)}
                        </td>

                        <td className="p-4 font-bold">
                          <div>
                            <span
                              className={
                                product.stock_quantity <= 5
                                  ? "text-red-600"
                                  : "text-emerald-600"
                              }
                            >
                              {product.stock_quantity}
                            </span>
                            <div className="text-[9px] text-slate-400 font-sans mt-0.5 space-x-1 font-semibold">
                              <span className="bg-slate-100 px-1 rounded">
                                S:{product.size_s_stock || 0}
                              </span>
                              <span className="bg-slate-100 px-1 rounded">
                                M:{product.size_m_stock || 0}
                              </span>
                              <span className="bg-slate-100 px-1 rounded">
                                L:{product.size_l_stock || 0}
                              </span>
                              <span className="bg-slate-100 px-1 rounded">
                                XL:{product.size_xl_stock || 0}
                              </span>
                              <span className="bg-slate-100 px-1 rounded">
                                XXL:{product.size_xxl_stock || 0}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="p-4">
                          {product.is_active === false ? (
                            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase">
                              Hidden
                            </span>
                          ) : (
                            <StatusBadge status={product.status} />
                          )}
                        </td>

                        <td className="p-4">
                          {manageProducts ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => toggleProductActive(product)}
                              title={product.is_active === false ? "Show in shop" : "Hide from shop"}
                              aria-label={product.is_active === false ? `Show ${product.name} in shop` : `Hide ${product.name} from shop`}
                              className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                            >
                              <Eye className={`w-4 h-4 ${product.is_active === false ? "opacity-40" : ""}`} />
                            </button>

                            <button
                              onClick={() => openEditProductModal(product)}
                              title="Edit"
                              aria-label={`Edit ${product.name}`}
                              className="p-2 rounded-lg bg-cream-card/60 text-slate-600 hover:text-sage-green"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => deleteProduct(product)}
                              title="Delete"
                              aria-label={`Delete ${product.name}`}
                              className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          ) : (
                            <p className="text-right text-xs text-slate-400 font-semibold">View only</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredProducts.length === 0 && (
                  <div className="p-10 text-center text-slate-400 font-bold">
                    No products found.
                  </div>
                )}
              </div>
            </section>
          )}

          {allowed && activeTab === "styles" && <AdminTaxonomy canManage={can("catalog.manage")} />}

          {allowed && activeTab === "skinTone" && (
            <section className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {[...skinTones, "All"].map((tone) => (
                  <Panel key={tone} title={tone === "All" ? "Suits every tone" : `${tone} Skin Tone`}>
                    <p className="text-3xl font-black text-brand-dark mb-2">
                      {products.filter((item) => item.compatible_skin_tone === tone).length}
                    </p>
                    <p className="text-sm text-slate-500 font-semibold">
                      {tone === "All" ? "Products marked for every skin tone." : `Products marked for ${tone} skin tone.`}
                    </p>
                  </Panel>
                ))}
              </div>
              <ToneRulesPanel canManage={can("catalog.manage")} />
            </section>
          )}

          {allowed && activeTab === "outfitRules" && (
            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Panel title="Smart Outfit Completion Engine">
                <div className="space-y-4 text-sm text-slate-600 font-semibold">
                  <RuleLine
                    selected="Shirt"
                    recommends="Pant + Shoes + Accessory / Watch"
                  />
                  <RuleLine
                    selected="Pant"
                    recommends="Shirt + Shoes + Accessory / Watch"
                  />
                  <RuleLine
                    selected="Shoes"
                    recommends="Shirt + Pant + Accessory / Watch"
                  />
                  <RuleLine
                    selected="Watch / Accessory"
                    recommends="Shirt + Pant + Shoes"
                  />
                  <RuleLine
                    selected="Shalwar Kameez"
                    recommends="Sandals / Chappals + Watch / Cap"
                  />
                  <RuleLine
                    selected="Coat / Jacket / Waistcoat"
                    recommends="Shirt + Pant + Shoes"
                  />
                </div>
              </Panel>

              <Panel title="Matching Logic">
                <div className="space-y-3">
                  <LogicItem text="Same Style: Eastern, Western, Formal, Casual" />
                  <LogicItem text="Same Skin Tone: Fair, Medium, Dark" />
                  <LogicItem text="Missing categories are recommended, leaving out the selected item" />
                  <LogicItem text="Reverse recommendation: picking shoes, trousers or an accessory first still completes the outfit" />
                  <LogicItem text="These pairings are built into the recommender engine and shown here for reference" />
                </div>
              </Panel>
            </section>
          )}

          {allowed && activeTab === "orders" && (
            <>
              {!selectedOrder ? (
                <DataPanel title="Customer Orders">
                  <table className="w-full min-w-[1000px] text-sm">
                    <thead className="bg-cream-base border-b border-slate-100">
                      <tr className="text-[11px] uppercase tracking-widest text-slate-400 font-black">
                        <th className="p-4 text-left">Order</th>
                        <th className="p-4 text-left">Customer</th>
                        <th className="p-4 text-left">Items</th>
                        <th className="p-4 text-left">Qty</th>
                        <th className="p-4 text-left">Total</th>
                        <th className="p-4 text-left">Profit</th>
                        <th className="p-4 text-left">Status</th>
                        <th className="p-4 text-left">Payment</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {orders.map((order) => {
                        const lines = orderLines(order);
                        return (
                          <tr key={order.id} className="hover:bg-cream-base">
                            <td className="p-4">
                              <p className="font-black text-sage-green">{order.order_code || `#${order.id}`}</p>
                              <p className="text-xs text-slate-400 font-semibold">{new Date(order.order_date).toLocaleDateString()}</p>
                            </td>

                            <td className="p-4">
                              <p className="font-black text-brand-dark">{order.customer_name || "N/A"}</p>
                              <p className="text-xs text-slate-400">{order.customer_phone || "No phone"}</p>
                            </td>

                            <td className="p-4 font-bold text-slate-700">
                              {lines.length > 1 ? `${lines[0].name} + ${lines.length - 1} more` : lines[0]?.name || "N/A"}
                            </td>

                            <td className="p-4 font-bold">{lines.reduce((sum, line) => sum + line.quantity, 0)}</td>

                            <td className="p-4 font-black">{formatPKR(order.total_amount)}</td>

                            <td className={`p-4 font-black ${Number(order.profit_amount) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                              {formatPKR(order.profit_amount)}
                            </td>

                            <td className="p-4">
                              <StatusBadge status={order.order_status} />
                            </td>

                            <td className="p-4 font-bold text-slate-600">{order.payment_status}</td>

                            <td className="p-4">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setSelectedOrderId(order.id)}
                                  className="w-10 h-10 rounded-xl bg-sage-green/10 text-sage-green hover:bg-sage-green/20 flex items-center justify-center"
                                  title="View order details"
                                  aria-label={`View order ${order.order_code || order.id}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                {manageOrders && (
                                  <button
                                    onClick={() => deleteOrder(order)}
                                    className="w-10 h-10 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 flex items-center justify-center"
                                    title="Delete order"
                                    aria-label={`Delete order ${order.order_code || order.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {orders.length === 0 && (
                    <div className="p-10 text-center text-slate-400 font-bold">No orders found.</div>
                  )}
                </DataPanel>
              ) : (
                <section className="space-y-6">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setSelectedOrderId(null)}
                      aria-label="Back to orders"
                      className="w-10 h-10 rounded-xl bg-white border border-brand-border/60 hover:bg-cream-base flex items-center justify-center"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div>
                      <h3 className="text-2xl font-black text-brand-dark">
                        {selectedOrder.order_code || `Order #${selectedOrder.id}`}
                      </h3>
                      <p className="text-sm text-slate-500 font-semibold mt-1">
                        {new Date(selectedOrder.order_date).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
                    <div className="bg-white rounded-2xl border border-brand-border/60 shadow-sm p-6">
                      <h4 className="text-lg font-black text-brand-dark mb-5">Order Items</h4>

                      <div className="space-y-4">
                        {orderLines(selectedOrder).map((line) => (
                          <div
                            key={line.key}
                            className="bg-cream-base rounded-2xl border border-slate-100 p-5 flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              {line.image && (
                                <img src={line.image} alt="" className="w-12 h-14 rounded-xl object-cover border border-brand-border/60 bg-cream-card/60" />
                              )}
                              <div className="min-w-0">
                                <p className="font-black text-brand-dark truncate">{line.name}</p>
                                <p className="text-sm text-slate-500 font-semibold mt-1">
                                  {formatPKR(line.price)} × {line.quantity}
                                  {line.size ? ` · Size ${line.size}` : ""}
                                </p>
                                {line.productId && (
                                  <p className="text-xs text-slate-400 font-bold mt-1">Product ID: {line.productId}</p>
                                )}
                              </div>
                            </div>

                            <p className="font-black text-brand-dark">{formatPKR(line.total)}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 border-t border-slate-100 pt-5 space-y-3">
                        <div className="flex justify-between text-xl font-black text-brand-dark">
                          <span>Total</span>
                          <span>{formatPKR(selectedOrder.total_amount)}</span>
                        </div>

                        <div className="flex justify-between text-sm font-black">
                          <span className="text-slate-500">Profit</span>
                          <span className={Number(selectedOrder.profit_amount) < 0 ? "text-red-600" : "text-emerald-600"}>
                            {formatPKR(selectedOrder.profit_amount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-white rounded-2xl border border-brand-border/60 shadow-sm p-6">
                        <h4 className="text-lg font-black text-brand-dark mb-5">Order Status</h4>

                        <div className="space-y-4">
                          <StatusBadge status={selectedOrder.order_status} />

                          {manageOrders && (NEXT_ORDER_STATUSES[selectedOrder.order_status] || []).length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {(NEXT_ORDER_STATUSES[selectedOrder.order_status] || []).map((next) => (
                                <button
                                  key={next}
                                  type="button"
                                  onClick={() => updateOrderStatus(selectedOrder.id, next)}
                                  className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider ${
                                    next === "Cancelled"
                                      ? "bg-red-50 text-red-700 hover:bg-red-100"
                                      : "bg-slate-900 text-white hover:opacity-90"
                                  }`}
                                >
                                  {next === "Cancelled" ? "Cancel order" : `Mark ${next}`}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 font-semibold">
                              {manageOrders ? "This order is final." : "Your role can view orders but not change them."}
                            </p>
                          )}
                          {selectedOrder.order_status !== "Cancelled" && manageOrders && (
                            <p className="text-xs text-slate-400 font-semibold">Cancelling puts the items back into stock.</p>
                          )}
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-brand-border/60 shadow-sm p-6">
                        <h4 className="text-lg font-black text-brand-dark mb-5">Customer Information</h4>

                        <div className="space-y-4">
                          <InfoRow label="Name" value={selectedOrder.customer_name || "N/A"} />
                          <InfoRow label="Phone" value={selectedOrder.customer_phone || "N/A"} />
                          <InfoRow label="Email" value={selectedOrder.customer_email || "N/A"} />
                          <InfoRow
                            label="Address"
                            value={[selectedOrder.customer_address, selectedOrder.city].filter(Boolean).join(", ") || "N/A"}
                          />
                          <InfoRow label="Payment" value={selectedOrder.payment_status || "N/A"} />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {allowed && activeTab === "bookings" && (
            <DataPanel title="Bookings">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-cream-base border-b border-slate-100">
                  <tr className="text-[11px] uppercase tracking-widest text-slate-400 font-black">
                    <th className="p-4 text-left">Booking ID</th>
                    <th className="p-4 text-left">Customer</th>
                    <th className="p-4 text-left">Product</th>
                    <th className="p-4 text-left">Type</th>
                    <th className="p-4 text-left">Date</th>
                    <th className="p-4 text-left">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="p-4 font-black text-sage-green">
                        #{booking.id}
                      </td>

                      <td className="p-4">
                        <p className="font-black text-brand-dark">
                          {booking.customer_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {booking.customer_phone}
                        </p>
                      </td>

                      <td className="p-4 font-bold text-slate-700">
                        {booking.product_name || "N/A"}
                      </td>

                      <td className="p-4 font-bold text-slate-600">
                        {booking.booking_type}
                      </td>

                      <td className="p-4 font-bold text-slate-600">
                        {new Date(booking.booking_date).toLocaleDateString()}
                      </td>

                      <td className="p-4">
                        <StatusBadge status={booking.status} />
                      </td>

                      <td className="p-4 w-[320px]">
                        {manageBookings ? (
                          <div className="flex justify-end items-center gap-2 flex-nowrap whitespace-nowrap">
                            {booking.status === "Pending" && (
                              <button
                                onClick={() => updateBookingStatus(booking.id, "Confirmed")}
                                className="px-3 py-2 rounded-lg bg-sage-green/10 text-sage-green text-xs font-black hover:bg-sage-green/20"
                              >
                                Confirm
                              </button>
                            )}
                            {(booking.status === "Pending" || booking.status === "Confirmed") && (
                              <>
                                <button
                                  onClick={() => updateBookingStatus(booking.id, "Completed")}
                                  className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-black hover:bg-emerald-100"
                                >
                                  Complete
                                </button>
                                <button
                                  onClick={() => updateBookingStatus(booking.id, "Cancelled")}
                                  className="px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-black hover:bg-amber-100"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => deleteBooking(booking.id)}
                              className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-black hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <p className="text-right text-xs text-slate-400 font-semibold">View only</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {bookings.length === 0 && (
                <div className="p-10 text-center text-slate-400 font-bold">
                  No bookings found.
                </div>
              )}
            </DataPanel>
          )}

          {allowed && activeTab === "faceScans" && (
            <DataPanel title="Face Scan Records">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-cream-base border-b border-slate-100">
                  <tr className="text-[11px] uppercase tracking-widest text-slate-400 font-black">
                    <th className="p-4 text-left">Record ID</th>
                    <th className="p-4 text-left">User</th>
                    <th className="p-4 text-left">Skin Tone</th>
                    <th className="p-4 text-left">Confidence</th>
                    <th className="p-4 text-left">Lighting</th>
                    <th className="p-4 text-left">Brightness</th>
                    <th className="p-4 text-left">Date</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {faceScans.map((record) => (
                    <tr key={record.id}>
                      <td className="p-4 font-black text-sage-green">
                        #{record.id}
                      </td>

                      <td className="p-4 font-bold text-slate-700">
                        {record.username || record.visitor_name || "Guest User"}
                      </td>

                      <td className="p-4">
                        <Badge>{record.detected_skin_tone}</Badge>
                      </td>

                      <td className="p-4 font-black">
                        {record.confidence_score}%
                      </td>

                      <td className="p-4 font-bold text-slate-600">
                        {record.lighting_quality || "N/A"}
                      </td>

                      <td className="p-4 font-bold text-slate-600">
                        {record.brightness}
                      </td>

                      <td className="p-4 font-bold text-slate-600">
                        {new Date(record.scan_date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {faceScans.length === 0 && (
                <div className="p-10 text-center text-slate-400 font-bold">No face scans yet.</div>
              )}
            </DataPanel>
          )}

          {allowed && activeTab === "team" && <TeamSection />}

          {allowed && activeTab === "settings" && <SettingsSection onLogout={onLogout} />}
        </main>
        </div>
      </div>

      {isProductModalOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-brand-border/60 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-brand-dark">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </h3>

                <p className="text-sm text-slate-500 font-semibold mt-1">
                  Create or update a Wear Right catalog item.
                </p>
              </div>

              <button
                onClick={closeProductModal}
                className="p-2 rounded-xl bg-cream-card/60 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Product Name"
                  value={productForm.name}
                  onChange={(value) =>
                    setProductForm({ ...productForm, name: value })
                  }
                  placeholder="Blue Formal Shirt"
                />

                <Select
                  label="Category"
                  value={productForm.category}
                  options={Array.from(new Set([...categories, productForm.category].filter(Boolean)))}
                  onChange={(value) =>
                    setProductForm({ ...productForm, category: value })
                  }
                />

                <Select
                  label="Style"
                  value={productForm.cultural_tag}
                  options={Array.from(new Set([...styles, productForm.cultural_tag].filter(Boolean)))}
                  onChange={(value) =>
                    setProductForm({ ...productForm, cultural_tag: value })
                  }
                />

                <Select
                  label="Compatible Skin Tone"
                  value={productForm.compatible_skin_tone}
                  options={[...skinTones, "All"]}
                  onChange={(value) =>
                    setProductForm({
                      ...productForm,
                      compatible_skin_tone: value,
                    })
                  }
                />

                <Select
                  label="Color"
                  value={productForm.color}
                  emptyLabel="Not set"
                  options={Array.from(new Set([productForm.color, ...colors].filter(Boolean)))}
                  onChange={(value) =>
                    setProductForm({ ...productForm, color: value })
                  }
                />

                <Select
                  label="Garment Type"
                  value={productForm.garment_type}
                  emptyLabel="Not set"
                  options={["Top", "Bottom", "Footwear", "Accessory"]}
                  onChange={(value) =>
                    setProductForm({ ...productForm, garment_type: value })
                  }
                />

                <Select
                  label="Type"
                  value={productForm.kind ? kindLabel(productForm.kind) : ""}
                  emptyLabel="Let the server guess"
                  options={kindOptions}
                  onChange={(option) =>
                    setProductForm({ ...productForm, kind: kindValue(option) })
                  }
                />

                <Select
                  label="Shop section"
                  value={productForm.gender}
                  emptyLabel="From the category"
                  options={shopSections}
                  onChange={(value) =>
                    setProductForm({ ...productForm, gender: value })
                  }
                />

                <Input
                  label="Cost Price"
                  type="number"
                  value={productForm.cost_price}
                  onChange={(value) =>
                    setProductForm({ ...productForm, cost_price: value })
                  }
                  placeholder="1800"
                />

                <Input
                  label="Selling Price"
                  type="number"
                  value={productForm.price}
                  onChange={(value) =>
                    setProductForm({ ...productForm, price: value })
                  }
                  placeholder="2500"
                />

                <div className="md:col-span-2 flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <span className="uppercase tracking-widest font-black">Outfit slot</span>
                  {/* Read-only: the slot is derived on the server from kind/category (edit the Category or Type to change it). */}
                  <span className="text-slate-600">
                    {editingProduct?.slot
                      ? editingProduct.slot.charAt(0).toUpperCase() + editingProduct.slot.slice(1)
                      : productForm.kind
                        ? "From the type once saved"
                        : "From the category once saved"}
                  </span>
                </div>

                {/* Editable Sizing Stocks */}
                <div className="md:col-span-3 bg-blue-50/20 border border-blue-200/40 rounded-2xl p-5 space-y-4">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
                    Edit Stock per Size
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <Input
                      label="Size S"
                      type="number"
                      value={productForm.size_s_stock}
                      onChange={(value) =>
                        setProductForm({ ...productForm, size_s_stock: value })
                      }
                      placeholder="0"
                    />
                    <Input
                      label="Size M"
                      type="number"
                      value={productForm.size_m_stock}
                      onChange={(value) =>
                        setProductForm({ ...productForm, size_m_stock: value })
                      }
                      placeholder="0"
                    />
                    <Input
                      label="Size L"
                      type="number"
                      value={productForm.size_l_stock}
                      onChange={(value) =>
                        setProductForm({ ...productForm, size_l_stock: value })
                      }
                      placeholder="0"
                    />
                    <Input
                      label="Size XL"
                      type="number"
                      value={productForm.size_xl_stock}
                      onChange={(value) =>
                        setProductForm({ ...productForm, size_xl_stock: value })
                      }
                      placeholder="0"
                    />
                    <Input
                      label="Size XXL"
                      type="number"
                      value={productForm.size_xxl_stock}
                      onChange={(value) =>
                        setProductForm({
                          ...productForm,
                          size_xxl_stock: value,
                        })
                      }
                      placeholder="0"
                    />
                  </div>

                  {sizeTotal > 0 ? (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-slate-500">Calculated Total Stock</span>
                      <span className="text-sm font-black text-brand-dark bg-cream-card px-3 py-1 rounded-xl">{sizeTotal} items</span>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                      <Input
                        label="Total stock (no sizes)"
                        type="number"
                        value={productForm.stock_quantity}
                        onChange={(value) => setProductForm({ ...productForm, stock_quantity: value })}
                        placeholder="0"
                      />
                      <p className="text-xs text-slate-400 font-semibold pb-3">
                        For one-size items such as watches and caps. Add per-size stock above for clothing.
                      </p>
                    </div>
                  )}
                </div>

                <Select
                  label="Status"
                  value={productForm.status}
                  options={Array.from(new Set([...statuses, productForm.status]))}
                  onChange={(value) =>
                    setProductForm({ ...productForm, status: value })
                  }
                />

                <label className="flex items-center gap-3 bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={productForm.is_active}
                    onChange={(event) =>
                      setProductForm({ ...productForm, is_active: event.target.checked })
                    }
                  />
                  Visible in shop
                </label>

                <label className="md:col-span-2 block">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                    Description
                  </span>
                  <textarea
                    value={productForm.description}
                    onChange={(event) =>
                      setProductForm({ ...productForm, description: event.target.value })
                    }
                    rows={3}
                    className="w-full bg-cream-base border border-brand-border/60 rounded-xl p-3 text-sm font-semibold"
                  />
                </label>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                  Product Image
                </label>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    handleImageChange(event.target.files?.[0] || null)
                  }
                  className="w-full bg-cream-base border border-brand-border/60 rounded-xl p-3 text-sm font-semibold"
                />

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {productImagePreview ? (
                    <img
                      src={productImagePreview}
                      alt="Product preview"
                      className="w-24 h-28 rounded-xl object-cover border border-brand-border/60 bg-cream-card/60"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={suggestColour}
                    disabled={!productImage || suggestingColour}
                    className="bg-slate-900 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
                  >
                    <Palette className="w-4 h-4" />
                    {suggestingColour ? "Reading image..." : "Suggest colour"}
                  </button>
                </div>

                {editingProduct && (
                  <p className="text-xs text-slate-400 font-semibold mt-2">
                    If you do not choose an image, the current one is kept.
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-brand-gold hover:opacity-90 text-white py-4 rounded-xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {editingProduct ? "Save Product" : "Create Product"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  note,
  warning = false,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  note: string;
  warning?: boolean;
}) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-brand-border/60 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-slate-400 font-black">
            {title}
          </p>

          <p
            className={`text-3xl font-black mt-3 ${
              warning ? "text-red-600" : "text-brand-dark"
            }`}
          >
            {value}
          </p>
        </div>

        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${
            warning
              ? "bg-red-50 text-red-600"
              : "bg-sage-green/10 text-sage-green"
          }`}
        >
          {icon}
        </div>
      </div>

      <p className="text-xs text-slate-400 font-bold mt-4">{note}</p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-brand-border/60 shadow-sm p-6">
      <h3 className="text-lg font-black text-brand-dark mb-5">{title}</h3>
      {children}
    </div>
  );
}

function DataPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-brand-border/60 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100">
        <h3 className="text-lg font-black text-brand-dark">{title}</h3>
      </div>

      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function ProgressRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div>
      <div className="flex justify-between text-sm font-bold mb-2">
        <span className="text-slate-700">{label}</span>
        <span className="text-slate-400">{value} products</span>
      </div>

      <div className="h-3 bg-cream-card/60 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex px-3 py-1 rounded-full bg-sage-green/10 text-sage-green text-xs font-black">
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isGood = [
    "Active",
    "Delivered",
    "Completed",
    "Confirmed",
    "Paid",
  ].includes(status);
  const isBad = ["Out of Stock", "Cancelled", "Inactive"].includes(status);

  return (
    <span
      className={`inline-flex px-3 py-1 rounded-full text-xs font-black ${
        isGood
          ? "bg-emerald-50 text-emerald-700"
          : isBad
            ? "bg-red-50 text-red-700"
            : "bg-amber-50 text-amber-700"
      }`}
    >
      {status}
    </span>
  );
}

function RuleLine({
  selected,
  recommends,
}: {
  selected: string;
  recommends: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-cream-base border border-slate-100">
      <p className="font-black text-brand-dark">If user selects: {selected}</p>
      <p className="text-slate-500 mt-1">Recommend: {recommends}</p>
    </div>
  );
}

function LogicItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-cream-base rounded-xl border border-slate-100">
      <div className="w-2 h-2 rounded-full bg-blue-600 mt-2" />
      <p className="text-sm font-bold text-slate-600">{text}</p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  emptyLabel,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  /** Adds a first option with value "" (shown with this label) for fields that may be blank. */
  emptyLabel?: string;
}) {
  return (
    <div>
      <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
      >
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-widest text-slate-400 font-black">
        {label}
      </p>

      <p className="text-sm font-bold text-slate-800 mt-1 break-words">
        {value}
      </p>
    </div>
  );
}
