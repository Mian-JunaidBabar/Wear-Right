"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  Bell,
  ShieldCheck,
  KeyRound,
  BadgeCheck,
  Eye,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { PLACEHOLDER_IMAGE } from "@/lib/config";
import { ApiError } from "@/lib/api";
import { catalogApi, type ApiCategory, type ApiStyle } from "@/features/catalog/api";
import AdminTaxonomy from "@/components/AdminTaxonomy";
import { useNavigate } from "@/lib/navigation";
import { useAuth } from "@/features/auth/AuthProvider";
import { adminApi } from "@/features/admin/api";
import { notify } from "@/lib/notify";

type DashboardData = {
  total_products: number;
  total_orders: number;
  total_bookings: number;
  total_face_scans: number;
  monthly_revenue: number;
  monthly_profit: number;
  low_stock_products: number;
  style_counts: {
    Eastern: number;
    Western: number;
    Formal: number;
    Casual: number;
  };
  skin_tone_counts: {
    Fair: number;
    Medium: number;
    Dark: number;
  };
};

type Product = {
  id: number;
  name: string;
  category: string;
  cultural_tag: string;
  compatible_skin_tone: string;
  color?: string;
  garment_type?: string;
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
  created_at?: string;
};

type Order = {
  id: number;
  order_code?: string | null;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  product: number;
  product_name: string;
  quantity: number;
  total_amount: string | number;
  profit_amount: string | number;
  order_status: string;
  payment_status: string;
  order_date: string;
  items?: Order[];
};

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

type ActiveTab =
  | "dashboard"
  | "products"
  | "styles"
  | "skinTone"
  | "outfitRules"
  | "orders"
  | "bookings"
  | "faceScans"
  | "team"
  | "settings";

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

const garmentTypes = ["Top", "Bottom", "Footwear", "Accessory"];

const emptyProductForm = {
  name: "",
  category: "Men Shirt",
  cultural_tag: "Formal",
  compatible_skin_tone: "Medium",
  color: "White",
  garment_type: "Top",
  cost_price: "0",
  price: "",
  stock_quantity: "0",
  size_s_stock: "0",
  size_m_stock: "0",
  size_l_stock: "0",
  size_xl_stock: "0",
  size_xxl_stock: "0",
  status: "Active",
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

export default function AdminView() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/");
  };

  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryRows, setCategoryRows] = useState<ApiCategory[]>([]);
  const [styleRows, setStyleRows] = useState<ApiStyle[]>([]);
  const categories = categoryRows.filter((row) => row.is_active).map((row) => row.name);
  const styles = styleRows.filter((row) => row.is_active).map((row) => row.name);
  const [orders, setOrders] = useState<Order[]>([]);

  const groupedOrders = useMemo(() => {
    const groups: { [key: string]: Order[] } = {};

    orders.forEach((order) => {
      // If order_code is missing, group by customer, date, and status
      const dateStr = new Date(order.order_date).toISOString().split("T")[0];
      const key =
        order.order_code ||
        `group-${order.customer_phone}-${dateStr}-${order.order_status}`;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(order);
    });

    return Object.keys(groups).map((key) => {
      const items = groups[key];
      const firstItem = items[0];

      const totalQty = items.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0,
      );
      const totalRev = items.reduce(
        (sum, item) => sum + Number(item.total_amount || 0),
        0,
      );
      const totalProf = items.reduce(
        (sum, item) => sum + Number(item.profit_amount || 0),
        0,
      );

      return {
        ...firstItem,
        id: firstItem.id,
        order_code: firstItem.order_code || `WR-${firstItem.id}`,
        quantity: totalQty,
        total_amount: totalRev,
        profit_amount: totalProf,
        items: items,
      };
    });
  }, [orders]);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [faceScans, setFaceScans] = useState<FaceScanRecord[]>([]);

  const [searchVal, setSearchVal] = useState("");
  const [loading, setLoading] = useState(true);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [productImage, setProductImage] = useState<File | null>(null);

  const fetchAllData = async () => {
    try {
      const [dashboardData, productsData, ordersData, bookingsData, faceScansData, categoriesData, stylesData] =
        await Promise.all([
          adminApi.dashboard<{ dashboard: DashboardData }>(),
          adminApi.products<{ products?: Product[] }>(),
          adminApi.orders<{ orders?: Order[] }>(),
          adminApi.bookings<{ bookings?: Booking[] }>(),
          adminApi.faceScans<{ face_scan_records?: FaceScanRecord[] }>(),
          catalogApi.categories(true),
          catalogApi.styles(true),
        ]);

      setDashboard(dashboardData.dashboard);
      setProducts(productsData.products || []);
      setOrders(ordersData.orders || []);
      setBookings(bookingsData.bookings || []);
      setFaceScans(faceScansData.face_scan_records || []);
      setCategoryRows(categoriesData.categories);
      setStyleRows(stylesData.styles);
    } catch (error) {
      console.error(error);
      notify("Admin data could not be loaded. Check that the server is running.");
    } finally {
      setLoading(false);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await fetchAllData();
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount: state is set after the request resolves
    void fetchAllData();
  }, []);

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
    setProductForm(emptyProductForm);
    setProductImage(null);
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      category: product.category,
      cultural_tag: product.cultural_tag,
      compatible_skin_tone: product.compatible_skin_tone,
      color: product.color || "White",
      garment_type: product.garment_type || "Top",
      cost_price: String(product.cost_price),
      price: String(product.price),
      stock_quantity: String(product.stock_quantity),
      size_s_stock: String(product.size_s_stock || 0),
      size_m_stock: String(product.size_m_stock || 0),
      size_l_stock: String(product.size_l_stock || 0),
      size_xl_stock: String(product.size_xl_stock || 0),
      size_xxl_stock: String(product.size_xxl_stock || 0),
      status: product.status,
    });
    setProductImage(null);
    setIsProductModalOpen(true);
  };

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    setEditingProduct(null);
    setProductForm(emptyProductForm);
    setProductImage(null);
  };

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
    formData.append("color", productForm.color);
    formData.append("garment_type", productForm.garment_type);
    formData.append("cost_price", productForm.cost_price || "0");
    formData.append("price", productForm.price);
    const totalStock =
      Number(productForm.size_s_stock || 0) +
      Number(productForm.size_m_stock || 0) +
      Number(productForm.size_l_stock || 0) +
      Number(productForm.size_xl_stock || 0) +
      Number(productForm.size_xxl_stock || 0);

    formData.append("stock_quantity", String(totalStock));
    formData.append("size_s_stock", productForm.size_s_stock || "0");
    formData.append("size_m_stock", productForm.size_m_stock || "0");
    formData.append("size_l_stock", productForm.size_l_stock || "0");
    formData.append("size_xl_stock", productForm.size_xl_stock || "0");
    formData.append("size_xxl_stock", productForm.size_xxl_stock || "0");
    formData.append("status", productForm.status);

    if (productImage) {
      formData.append("image", productImage);
    }

    try {
      await adminApi.saveProduct(editingProduct ? editingProduct.id : null, formData);

      closeProductModal();
      await loadAllData();
    } catch (error) {
      console.error(error);
      notify(
        error instanceof ApiError && error.status === 400
          ? `The product was not saved: ${describeApiErrors(error.details)}`
          : "The product could not be saved. Please try again.",
        "error",
      );
    }
  };

  const deleteProduct = async (productId: number) => {
    const confirmDelete = confirm("Kya tum ye product delete karna chahte ho?");

    if (!confirmDelete) return;

    try {
      await adminApi.deleteProduct(productId);

      await loadAllData();
    } catch (error) {
      console.error(error);
      notify("Could not delete. Please try again.");
    }
  };

  const updateBookingStatus = async (bookingId: number, newStatus: string) => {
    try {
      await adminApi.updateBooking(bookingId, { status: newStatus });

      await loadAllData();
    } catch (error) {
      console.error(error);
      notify("Could not update the booking status. Please try again.");
    }
  };

  const deleteBooking = async (bookingId: number) => {
    const confirmDelete = confirm("Kya tum ye booking delete karna chahte ho?");

    if (!confirmDelete) return;

    try {
      await adminApi.deleteBooking(bookingId);

      await loadAllData();
    } catch (error) {
      console.error(error);
      notify("Could not delete the booking. Please try again.");
    }
  };

  const updateOrderStatus = async (
    orderId: number,
    newStatus: string,
    itemsToUpdate?: Order[],
  ) => {
    try {
      const list =
        itemsToUpdate ||
        (selectedOrder &&
          selectedOrder.id === orderId &&
          selectedOrder.items) ||
        [];

      if (list.length > 0) {
        for (const item of list) {
          await adminApi.updateOrder(item.id, { order_status: newStatus });
        }
      } else {
        await adminApi.updateOrder(orderId, { order_status: newStatus });
      }

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          order_status: newStatus,
          items: selectedOrder.items
            ? selectedOrder.items.map((item) => ({
                ...item,
                order_status: newStatus,
              }))
            : undefined,
        });
      }

      await loadAllData();
    } catch (error) {
      console.error(error);
      notify("Could not update the order status. Please try again.");
    }
  };

  const deleteOrder = async (orderId: number, itemsToDelete?: Order[]) => {
    const confirmDelete = confirm("Kya tum ye order delete karna chahte ho?");

    if (!confirmDelete) return;

    try {
      const list =
        itemsToDelete ||
        (selectedOrder &&
          selectedOrder.id === orderId &&
          selectedOrder.items) ||
        [];

      if (list.length > 0) {
        for (const item of list) {
          await adminApi.deleteOrder(item.id);
        }
      } else {
        await adminApi.deleteOrder(orderId);
      }

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(null);
      }

      await loadAllData();
    } catch (error) {
      console.error(error);
      notify("Could not delete the order. Please try again.");
    }
  };

  const navItems = [
    { id: "dashboard" as ActiveTab, label: "Dashboard", icon: LayoutDashboard },
    { id: "products" as ActiveTab, label: "Products", icon: Package },
    { id: "styles" as ActiveTab, label: "Categories & Styles", icon: Tags },
    { id: "skinTone" as ActiveTab, label: "Skin Tone Matrix", icon: Palette },
    { id: "outfitRules" as ActiveTab, label: "Outfit Rules", icon: Sparkles },
    { id: "orders" as ActiveTab, label: "Orders", icon: ShoppingCart },
    { id: "bookings" as ActiveTab, label: "Bookings", icon: CalendarCheck },
    { id: "faceScans" as ActiveTab, label: "Face Scans", icon: ScanFace },
    { id: "team" as ActiveTab, label: "Team Members", icon: Users },
    { id: "settings" as ActiveTab, label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-cream-base text-left font-sans">
      <div className="flex min-h-screen">
        <aside className="w-72 bg-white border-r border-brand-border/60 hidden lg:flex flex-col">
          <div className="px-6 py-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-brand-border/60 shadow-sm flex items-center justify-center overflow-hidden">
                <img
                  src="/brand/wr-icon.png"
                  alt="Wear Right Icon"
                  className="w-11 h-11 object-contain"
                  onError={(event) => {
                    event.currentTarget.src = "/brand/wr-monogram.png";
                  }}
                />
              </div>

              <div>
                <h1 className="text-lg font-black text-brand-dark">
                  Wear Right
                </h1>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  Admin Panel
                </p>
              </div>
            </div>
          </div>

          <nav className="p-4 space-y-1 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSelectedOrder(null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? "bg-sage-green/10 text-sage-green"
                      : "text-slate-500 hover:bg-cream-base hover:text-brand-dark"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-100">
            <button
              onClick={loadAllData}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wider"
            >
              <RefreshCcw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh Data
            </button>
          </div>
        </aside>

        <main className="flex-1 p-4 sm:p-8 overflow-x-hidden">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-bold text-sage-green uppercase tracking-widest">
                AI Clothing Recommendation System
              </p>

              <h2 className="text-3xl font-black text-brand-dark mt-1">
                {selectedOrder
                  ? `Order #${selectedOrder.id}`
                  : navItems.find((item) => item.id === activeTab)?.label}
              </h2>

              <p className="text-sm text-slate-500 mt-2">
                Manage products, orders, bookings, skin tone records and
                outfit recommendation data.
              </p>
            </div>

            <button
              onClick={loadAllData}
              className="flex items-center justify-center gap-2 bg-white border border-brand-border/60 px-5 py-3 rounded-xl text-sm font-bold text-slate-700 hover:bg-cream-card/60"
            >
              <RefreshCcw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </header>

          {activeTab === "dashboard" && (
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
                          dashboard?.style_counts?.[
                            style as keyof DashboardData["style_counts"]
                          ] || 0
                        }
                        total={dashboard?.total_products || 1}
                      />
                    ))}
                  </div>
                </Panel>

                <Panel title="Products by Skin Tone">
                  <div className="space-y-4">
                    {skinTones.map((tone) => (
                      <ProgressRow
                        key={tone}
                        label={tone}
                        value={
                          dashboard?.skin_tone_counts?.[
                            tone as keyof DashboardData["skin_tone_counts"]
                          ] || 0
                        }
                        total={dashboard?.total_products || 1}
                      />
                    ))}
                  </div>
                </Panel>
              </div>
            </section>
          )}

          {activeTab === "products" && (
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

                <button
                  onClick={openAddProductModal}
                  className="bg-brand-gold hover:opacity-90 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1150px] text-sm">
                  <thead className="bg-cream-base border-b border-slate-100">
                    <tr className="text-[11px] uppercase tracking-widest text-slate-400 font-black">
                      <th className="p-4 text-left min-w-[250px]">Product</th>
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
                        <td className="p-4">
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
                          <StatusBadge status={product.status} />
                        </td>

                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEditProductModal(product)}
                              className="p-2 rounded-lg bg-cream-card/60 text-slate-600 hover:text-sage-green"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => deleteProduct(product.id)}
                              className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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

          {activeTab === "styles" && <AdminTaxonomy />}

          {activeTab === "skinTone" && (
            <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {skinTones.map((tone) => (
                <Panel key={tone} title={`${tone} Skin Tone`}>
                  <p className="text-3xl font-black text-brand-dark mb-2">
                    {
                      products.filter(
                        (item) => item.compatible_skin_tone === tone,
                      ).length
                    }
                  </p>

                  <p className="text-sm text-slate-500 font-semibold">
                    Products compatible with {tone} skin tone.
                  </p>
                </Panel>
              ))}
            </section>
          )}

          {activeTab === "outfitRules" && (
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
                  <LogicItem text="Reverse recommendation supported: Shoes/Pant/Accessory select karne par bhi outfit complete hota hai" />
                </div>
              </Panel>
            </section>
          )}

          {activeTab === "orders" && (
            <>
              {!selectedOrder ? (
                <DataPanel title="Customer Orders">
                  <table className="w-full min-w-[1050px] text-sm">
                    <thead className="bg-cream-base border-b border-slate-100">
                      <tr className="text-[11px] uppercase tracking-widest text-slate-400 font-black">
                        <th className="p-4 text-left">Order</th>
                        <th className="p-4 text-left">Customer</th>
                        <th className="p-4 text-left">Product</th>
                        <th className="p-4 text-left">Qty</th>
                        <th className="p-4 text-left">Revenue</th>
                        <th className="p-4 text-left">Profit</th>
                        <th className="p-4 text-left">Status</th>
                        <th className="p-4 text-left">Payment</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {groupedOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-cream-base">
                          <td className="p-4 font-black text-sage-green">
                            {order.order_code || `#${order.id}`}
                          </td>

                          <td className="p-4">
                            <p className="font-black text-brand-dark">
                              {order.customer_name || "N/A"}
                            </p>
                            <p className="text-xs text-slate-400">
                              {order.customer_phone || "No phone"}
                            </p>
                          </td>

                          <td className="p-4 font-bold text-slate-700">
                            {order.items && order.items.length > 1
                              ? `${order.items[0].product_name} + ${order.items.length - 1} more`
                              : order.product_name}
                          </td>

                          <td className="p-4 font-bold">{order.quantity}</td>

                          <td className="p-4 font-black">
                            {formatPKR(order.total_amount)}
                          </td>

                          <td
                            className={`p-4 font-black ${
                              Number(order.profit_amount) < 0
                                ? "text-red-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {formatPKR(order.profit_amount)}
                          </td>

                          <td className="p-4">
                            <StatusBadge status={order.order_status} />
                          </td>

                          <td className="p-4 font-bold text-slate-600">
                            {order.payment_status}
                          </td>

                          <td className="p-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setSelectedOrder(order)}
                                className="w-10 h-10 rounded-xl bg-sage-green/10 text-sage-green hover:bg-sage-green/20 flex items-center justify-center"
                                title="View order details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => deleteOrder(order.id)}
                                className="w-10 h-10 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 flex items-center justify-center"
                                title="Delete order"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {orders.length === 0 && (
                    <div className="p-10 text-center text-slate-400 font-bold">
                      No orders found.
                    </div>
                  )}
                </DataPanel>
              ) : (
                <section className="space-y-6">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setSelectedOrder(null)}
                      className="w-10 h-10 rounded-xl bg-white border border-brand-border/60 hover:bg-cream-base flex items-center justify-center"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div>
                      <h3 className="text-3xl font-black text-brand-dark">
                        Order #{selectedOrder.id}
                      </h3>

                      <p className="text-sm text-slate-500 font-semibold mt-1">
                        {new Date(selectedOrder.order_date).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
                    <div className="bg-white rounded-2xl border border-brand-border/60 shadow-sm p-6">
                      <h4 className="text-lg font-black text-brand-dark mb-5">
                        Order Items
                      </h4>

                      <div className="space-y-4">
                        {(selectedOrder.items && selectedOrder.items.length > 0
                          ? selectedOrder.items
                          : [selectedOrder]
                        ).map((item, index) => (
                          <div
                            key={item.id || index}
                            className="bg-cream-base rounded-2xl border border-slate-100 p-5 flex items-center justify-between gap-4"
                          >
                            <div>
                              <p className="font-black text-brand-dark">
                                {item.product_name}
                              </p>

                              <p className="text-sm text-slate-500 font-semibold mt-1">
                                {formatPKR(item.total_amount)} × {item.quantity}
                              </p>

                              <p className="text-xs text-slate-400 font-bold mt-1">
                                Product ID: {item.product}
                              </p>
                            </div>

                            <p className="font-black text-brand-dark">
                              {formatPKR(item.total_amount)}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 border-t border-slate-100 pt-5 space-y-3">
                        <div className="flex justify-between text-sm font-bold text-slate-500">
                          <span>Subtotal</span>
                          <span>{formatPKR(selectedOrder.total_amount)}</span>
                        </div>

                        <div className="flex justify-between text-xl font-black text-brand-dark">
                          <span>Total</span>
                          <span>{formatPKR(selectedOrder.total_amount)}</span>
                        </div>

                        <div className="flex justify-between text-sm font-black">
                          <span className="text-slate-500">Profit</span>
                          <span
                            className={
                              Number(selectedOrder.profit_amount) < 0
                                ? "text-red-600"
                                : "text-emerald-600"
                            }
                          >
                            {formatPKR(selectedOrder.profit_amount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-white rounded-2xl border border-brand-border/60 shadow-sm p-6">
                        <h4 className="text-lg font-black text-brand-dark mb-5">
                          Order Status
                        </h4>

                        <div className="space-y-4">
                          <StatusBadge status={selectedOrder.order_status} />

                          <select
                            value={selectedOrder.order_status}
                            onChange={(event) =>
                              updateOrderStatus(
                                selectedOrder.id,
                                event.target.value,
                              )
                            }
                            className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Shipped">Shipped</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-brand-border/60 shadow-sm p-6">
                        <h4 className="text-lg font-black text-brand-dark mb-5">
                          Customer Information
                        </h4>

                        <div className="space-y-4">
                          <InfoRow
                            label="Name"
                            value={selectedOrder.customer_name || "N/A"}
                          />
                          <InfoRow
                            label="Phone"
                            value={selectedOrder.customer_phone || "N/A"}
                          />
                          <InfoRow
                            label="Email"
                            value={selectedOrder.customer_email || "N/A"}
                          />
                          <InfoRow
                            label="Address"
                            value={selectedOrder.customer_address || "N/A"}
                          />
                          <InfoRow
                            label="Payment"
                            value={selectedOrder.payment_status || "N/A"}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {activeTab === "bookings" && (
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
                        <div className="flex justify-end items-center gap-2 flex-nowrap whitespace-nowrap">
                          <button
                            onClick={() =>
                              updateBookingStatus(booking.id, "Confirmed")
                            }
                            className="px-3 py-2 rounded-lg bg-sage-green/10 text-sage-green text-xs font-black hover:bg-sage-green/20 whitespace-nowrap"
                          >
                            Confirm
                          </button>

                          <button
                            onClick={() =>
                              updateBookingStatus(booking.id, "Completed")
                            }
                            className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-black hover:bg-emerald-100 whitespace-nowrap"
                          >
                            Complete
                          </button>

                          <button
                            onClick={() =>
                              updateBookingStatus(booking.id, "Cancelled")
                            }
                            className="px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-black hover:bg-amber-100 whitespace-nowrap"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => deleteBooking(booking.id)}
                            className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-black hover:bg-red-100 whitespace-nowrap"
                          >
                            Delete
                          </button>
                        </div>
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

          {activeTab === "faceScans" && (
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
            </DataPanel>
          )}

          {activeTab === "team" && (
            <section className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <MetricCard
                  title="Total Members"
                  value={4}
                  icon={<Users className="w-5 h-5" />}
                  note="Admin panel access"
                />

                <MetricCard
                  title="Active"
                  value={3}
                  icon={<Users className="w-5 h-5" />}
                  note="Currently active"
                />

                <MetricCard
                  title="Admins"
                  value={1}
                  icon={<ShieldCheck className="w-5 h-5" />}
                  note="Full access"
                />

                <MetricCard
                  title="Staff"
                  value={3}
                  icon={<Users className="w-5 h-5" />}
                  note="Limited access"
                />
              </div>

              <DataPanel title="Team Members">
                <table className="w-full min-w-[850px] text-sm">
                  <thead className="bg-cream-base border-b border-slate-100">
                    <tr className="text-[11px] uppercase tracking-widest text-slate-400 font-black">
                      <th className="p-4 text-left">Member</th>
                      <th className="p-4 text-left">Email</th>
                      <th className="p-4 text-left">Role</th>
                      <th className="p-4 text-left">Access</th>
                      <th className="p-4 text-left">Status</th>
                      <th className="p-4 text-left">Last Active</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {[
                      {
                        name: "Hammad Ahmad",
                        email: "hammadahmadch17@gmail.com",
                        role: "Admin",
                        access: "Full Access",
                        status: "Active",
                        last: "Today",
                      },
                      {
                        name: "Ali Tariq",
                        email: "ali@example.com",
                        role: "Manager",
                        access: "Products + Orders",
                        status: "Active",
                        last: "1 day ago",
                      },
                      {
                        name: "Sameer Ahmad",
                        email: "sameer@example.com",
                        role: "Inventory Staff",
                        access: "Products Only",
                        status: "Active",
                        last: "2 days ago",
                      },
                      {
                        name: "Order Handler",
                        email: "staff@example.com",
                        role: "Order Handler",
                        access: "Orders + Bookings",
                        status: "Inactive",
                        last: "1 week ago",
                      },
                    ].map((member) => (
                      <tr key={member.email}>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-sage-green/10 text-sage-green flex items-center justify-center font-black">
                              {member.name.charAt(0)}
                            </div>

                            <p className="font-black text-brand-dark">
                              {member.name}
                            </p>
                          </div>
                        </td>

                        <td className="p-4 font-bold text-slate-600">
                          {member.email}
                        </td>

                        <td className="p-4">
                          <Badge>{member.role}</Badge>
                        </td>

                        <td className="p-4 font-bold text-slate-600">
                          {member.access}
                        </td>

                        <td className="p-4">
                          <StatusBadge status={member.status} />
                        </td>

                        <td className="p-4 font-bold text-slate-500">
                          {member.last}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataPanel>
            </section>
          )}

          {activeTab === "settings" && (
            <section className="space-y-6">
              <Panel title="Admin Profile">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-center">
                  <div className="md:col-span-1">
                    <div className="w-24 h-24 rounded-3xl bg-sage-green/10 text-sage-green flex items-center justify-center text-4xl font-black border border-brand-border/40">
                      H
                    </div>
                  </div>

                  <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ReadOnlyBox label="Full Name" value="Hammad Ahmad" />
                    <ReadOnlyBox
                      label="Email Address"
                      value="hammadahmadch17@gmail.com"
                    />
                    <ReadOnlyBox label="Role" value="Super Admin" />

                    <button className="w-full bg-blue-600 text-white rounded-xl px-4 py-3 text-sm font-black flex items-center justify-center gap-2">
                      <KeyRound className="w-4 h-4" />
                      Change Password
                    </button>
                  </div>
                </div>
              </Panel>

              <Panel title="Notifications">
                <div className="space-y-3">
                  <SettingToggle
                    title="New Order Alert"
                    description="Jab customer new order place kare"
                    enabled
                  />
                  <SettingToggle
                    title="New Booking Alert"
                    description="Jab customer booking request create kare"
                    enabled
                  />
                  <SettingToggle
                    title="Low Stock Alert"
                    description="Jab product stock 5 ya us se kam ho"
                    enabled
                  />
                  <SettingToggle
                    title="Face Scan Alert"
                    description="Jab user face scan complete kare"
                    enabled
                  />
                  <SettingToggle
                    title="Order Status Change"
                    description="Jab order pending se delivered/cancelled ho"
                    enabled
                  />
                </div>
              </Panel>

              <Panel title="Booking Configuration">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <BookingBox
                    title="Virtual Mannequin Preview"
                    status="Active"
                  />
                  <BookingBox title="Styling Consultation" status="Active" />
                  <BookingBox title="Outfit Trial Request" status="Active" />
                </div>
              </Panel>

              <Panel title="Product Badges">
                <div className="flex flex-wrap gap-3">
                  {[
                    "Best Seller",
                    "New Arrival",
                    "Highly Recommended",
                    "Low Stock",
                    "Formal",
                    "Casual",
                    "Eastern",
                    "Western",
                  ].map((badge) => (
                    <span
                      key={badge}
                      className="px-4 py-2 rounded-xl bg-sage-green/10 text-sage-green text-xs font-black border border-brand-border/40 flex items-center gap-2"
                    >
                      <BadgeCheck className="w-3.5 h-3.5" />
                      {badge}
                    </span>
                  ))}
                </div>
              </Panel>

              <Panel title="Session Management">
                <div className="bg-red-50/10 border border-red-200/45 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-red-600">
                      Sign Out of Admin Panel
                    </h4>
                    <p className="text-xs text-slate-400 font-sans mt-0.5">
                      End your administrative session on this device.
                    </p>
                  </div>
                  <button
                    onClick={onLogout}
                    className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md cursor-pointer border-none"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout Admin
                  </button>
                </div>
              </Panel>
            </section>
          )}
        </main>
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
                  options={categories}
                  onChange={(value) =>
                    setProductForm({ ...productForm, category: value })
                  }
                />

                <Select
                  label="Style"
                  value={productForm.cultural_tag}
                  options={styles}
                  onChange={(value) =>
                    setProductForm({ ...productForm, cultural_tag: value })
                  }
                />

                <Select
                  label="Compatible Skin Tone"
                  value={productForm.compatible_skin_tone}
                  options={skinTones}
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
                  options={colors}
                  onChange={(value) =>
                    setProductForm({ ...productForm, color: value })
                  }
                />

                <Select
                  label="Garment Type"
                  value={productForm.garment_type}
                  options={garmentTypes}
                  onChange={(value) =>
                    setProductForm({ ...productForm, garment_type: value })
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

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-500">
                      Calculated Total Stock
                    </span>
                    <span className="text-sm font-black text-brand-dark bg-cream-card px-3 py-1 rounded-xl">
                      {Number(productForm.size_s_stock || 0) +
                        Number(productForm.size_m_stock || 0) +
                        Number(productForm.size_l_stock || 0) +
                        Number(productForm.size_xl_stock || 0) +
                        Number(productForm.size_xxl_stock || 0)}{" "}
                      items
                    </span>
                  </div>
                </div>

                <Select
                  label="Status"
                  value={productForm.status}
                  options={statuses}
                  onChange={(value) =>
                    setProductForm({ ...productForm, status: value })
                  }
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                  Product Image
                </label>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setProductImage(event.target.files?.[0] || null)
                  }
                  className="w-full bg-cream-base border border-brand-border/60 rounded-xl p-3 text-sm font-semibold"
                />

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
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
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
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function SettingToggle({
  title,
  description,
  enabled,
}: {
  title: string;
  description: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-cream-base rounded-xl border border-slate-100">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-sage-green/10 text-sage-green flex items-center justify-center">
          <Bell className="w-4 h-4" />
        </div>

        <div>
          <p className="font-black text-brand-dark">{title}</p>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            {description}
          </p>
        </div>
      </div>

      <div
        className={`w-12 h-6 rounded-full p-1 ${
          enabled ? "bg-blue-600" : "bg-slate-300"
        }`}
      >
        <div
          className={`w-4 h-4 bg-white rounded-full transition-all ${
            enabled ? "ml-6" : "ml-0"
          }`}
        />
      </div>
    </div>
  );
}

function BookingBox({ title, status }: { title: string; status: string }) {
  return (
    <div className="p-5 rounded-xl bg-cream-base border border-slate-100">
      <p className="font-black text-brand-dark">{title}</p>

      <p className="text-xs text-slate-500 font-semibold mt-2">
        Booking type available for customers
      </p>

      <div className="mt-4">
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

function ReadOnlyBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
        {label}
      </label>

      <input
        value={value}
        readOnly
        className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-bold text-slate-700"
      />
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
