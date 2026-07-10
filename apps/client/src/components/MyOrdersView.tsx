import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Download,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
} from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

type ApiOrder = {
  id: number;
  order_code?: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  product: number;
  product_name: string;
  product_image_url: string;
  quantity: number;
  total_amount: string;
  profit_amount?: string;
  order_status: string;
  payment_status: string;
  order_date: string;
  items?: ApiOrder[];
};

function formatPKR(value: string | number | undefined) {
  const num = Number(value || 0);
  return `Rs. ${num.toLocaleString('en-PK')}`;
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString('en-PK', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return value;
  }
}

function getStatusStyle(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus.includes('confirmed')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }

  if (normalizedStatus.includes('delivered')) {
    return 'bg-sage-green/10 text-sage-green border-brand-border/40';
  }

  if (normalizedStatus.includes('cancel')) {
    return 'bg-red-50 text-red-700 border-red-100';
  }

  return 'bg-amber-50 text-amber-700 border-amber-100';
}

export default function MyOrdersView() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchText, setSearchText] = useState('');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setErrorMessage('');

      const response = await fetch('http://127.0.0.1:8000/api/orders/');

      if (!response.ok) {
        throw new Error('Orders API response was not successful.');
      }

      const data = await response.json();

      if (data.status === 'success') {
        setOrders(data.orders || []);
      } else {
        throw new Error(data.message || 'Unable to load orders.');
      }
    } catch (error) {
      console.error('Orders API Error:', error);
      setErrorMessage('Unable to load orders from backend API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const groupedOrders = useMemo(() => {
    const groups: { [key: string]: ApiOrder[] } = {};

    orders.forEach((order) => {
      // If order_code is missing, group by customer, date, and status
      const dateStr = new Date(order.order_date).toISOString().split('T')[0];
      const key = order.order_code || `group-${order.customer_phone}-${dateStr}-${order.order_status}`;
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    });

    return Object.keys(groups).map((key) => {
      const items = groups[key];
      const firstItem = items[0];

      const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const totalRev = items.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);

      return {
        ...firstItem,
        id: firstItem.id,
        order_code: firstItem.order_code || `WR-${firstItem.id}`,
        quantity: totalQty,
        total_amount: totalRev.toString(),
        items: items,
      };
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    if (!search) {
      return groupedOrders;
    }

    return groupedOrders.filter((order) => {
      const combinedText = `
        ${order.id}
        ${order.customer_name}
        ${order.customer_email}
        ${order.customer_phone}
        ${order.product_name}
        ${order.order_status}
        ${order.payment_status}
      `.toLowerCase();

      return combinedText.includes(search);
    });
  }, [orders, searchText]);

  const totalSpent = useMemo(() => {
    return filteredOrders.reduce((total, order) => {
      return total + Number(order.total_amount || 0);
    }, 0);
  }, [filteredOrders]);

  const downloadInvoicePDF = (order: ApiOrder) => {
    const invoiceHtml = `
<div class="pdf-container">
  <style>
    * {
      box-sizing: border-box;
    }

    .pdf-container {
      margin: 0;
      padding: 40px;
      font-family: Arial, Helvetica, sans-serif;
      background: #f8fafc;
      color: #0f172a;
    }

    .invoice {
      max-width: 850px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08);
    }

    .header {
      background: #020617;
      color: white;
      padding: 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .logo {
      width: 72px;
      height: 72px;
      border-radius: 18px;
      background: white;
      object-fit: contain;
      padding: 8px;
    }

    .brand h1 {
      margin: 0;
      font-size: 32px;
      letter-spacing: -1px;
    }

    .brand p {
      margin: 6px 0 0;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #cbd5e1;
      font-weight: 700;
    }

    .order-code {
      text-align: right;
    }

    .order-code span {
      display: block;
      font-size: 11px;
      color: #93c5fd;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 800;
    }

    .order-code strong {
      display: block;
      margin-top: 8px;
      font-size: 26px;
    }

    .content {
      padding: 32px;
    }

    .success-box {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
      padding: 14px 18px;
      border-radius: 16px;
      font-weight: 800;
      margin-bottom: 28px;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 28px;
    }

    .card {
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      padding: 20px;
      background: #f8fafc;
    }

    .card h2 {
      margin: 0 0 16px;
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #334155;
    }

    .line {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 10px;
      font-size: 13px;
    }

    .line span {
      color: #64748b;
      font-weight: 700;
    }

    .line strong {
      text-align: right;
      color: #0f172a;
    }

    .product-box {
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      overflow: hidden;
      margin-bottom: 28px;
    }

    .product-header {
      background: #f1f5f9;
      padding: 16px 20px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #334155;
      font-size: 14px;
    }

    .product-content {
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .product-image {
      width: 110px;
      height: 130px;
      object-fit: cover;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
    }

    .product-info h3 {
      margin: 0 0 8px;
      font-size: 22px;
    }

    .product-info p {
      margin: 4px 0;
      color: #64748b;
      font-size: 14px;
      font-weight: 700;
    }

    .total-box {
      background: #020617;
      color: white;
      border-radius: 20px;
      padding: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .total-box span {
      color: #cbd5e1;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-size: 12px;
    }

    .total-box strong {
      font-size: 32px;
    }

    .footer {
      text-align: center;
      padding: 24px 32px 32px;
      color: #64748b;
      font-size: 12px;
      font-weight: 700;
    }

    .no-print {
      max-width: 850px;
      margin: 20px auto 0;
      text-align: center;
    }

    .print-button {
      background: #2563eb;
      color: white;
      border: 0;
      padding: 14px 28px;
      border-radius: 14px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }

      .invoice {
        box-shadow: none;
        border-radius: 0;
        max-width: 100%;
        border: none;
      }

      .no-print {
        display: none;
      }
    }
  </style>
  <div class="invoice">
    <div class="header">
      <div class="brand">
        <img src="${window.location.origin}/brand/wr-icon.png" class="logo" />
        <div>
          <h1>Wear Right</h1>
          <p>Right Style. Right You.</p>
        </div>
      </div>

      <div class="order-code">
        <span>Invoice / Order ID</span>
        <strong>${order.order_code || `WR-${order.id}`}</strong>
      </div>
    </div>

    <div class="content">
      <div class="success-box">
        Order placed successfully. This invoice confirms your Wear Right order.
      </div>

      <div class="grid">
        <div class="card">
          <h2>Customer Details</h2>

          <div class="line">
            <span>Name</span>
            <strong>${order.customer_name}</strong>
          </div>

          <div class="line">
            <span>Email</span>
            <strong>${order.customer_email || 'Not provided'}</strong>
          </div>

          <div class="line">
            <span>Phone</span>
            <strong>${order.customer_phone}</strong>
          </div>

          <div class="line">
            <span>Address</span>
            <strong>${order.customer_address}</strong>
          </div>
        </div>

        <div class="card">
          <h2>Order Details</h2>

          <div class="line">
            <span>Order ID</span>
            <strong>${order.order_code || `WR-${order.id}`}</strong>
          </div>

          <div class="line">
            <span>Order Date</span>
            <strong>${formatDate(order.order_date)}</strong>
          </div>

          <div class="line">
            <span>Order Status</span>
            <strong>${order.order_status}</strong>
          </div>

          <div class="line">
            <span>Payment</span>
            <strong>${order.payment_status}</strong>
          </div>
        </div>
      </div>

      <div class="product-box">
        <div class="product-header">
          Product Details
        </div>

        ${(order.items && order.items.length > 0 ? order.items : [order]).map(item => `
        <div class="product-content" style="border-bottom: 1px solid #e2e8f0;">
          <img
            src="${item.product_image_url || 'https://placehold.co/120x160?text=Wear+Right'}"
            class="product-image"
          />

          <div class="product-info">
            <h3>${item.product_name}</h3>
            <p>Quantity: ${item.quantity}</p>
            <p>Product ID: ${item.product}</p>
            <p>Amount: ${formatPKR(item.total_amount)}</p>
          </div>
        </div>
        `).join('')}
      </div>

      <div class="total-box">
        <span>Total Amount</span>
        <strong>${formatPKR(order.total_amount)}</strong>
      </div>
    </div>

    <div class="footer">
      Thank you for shopping with Wear Right. For support, contact Wear Right admin.
    </div>
  </div>

</div>
`;

    const element = document.createElement('div');
    element.innerHTML = invoiceHtml;

    const opt = {
      margin: 0,
      filename: `WearRight_Invoice_${order.order_code || `WR-${order.id}`}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-cream-base px-6 py-10 text-left font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <button
              onClick={() => navigate('/profile')}
              className="mb-5 bg-white hover:bg-cream-card/60 border border-brand-border/60 text-slate-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Profile
            </button>

            <p className="text-[10px] uppercase tracking-widest text-sage-green font-black mb-2">
              Order History
            </p>

            <h1 className="text-3xl sm:text-5xl font-black text-brand-dark tracking-tight">
              My Orders
            </h1>

            <p className="text-sm text-slate-500 font-semibold mt-3 max-w-2xl">
              View your placed orders, status, payment method, product details and professional invoice.
            </p>
          </div>

          <button
            onClick={fetchOrders}
            className="bg-brand-gold hover:opacity-90 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-brand-gold/10"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Orders
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <SummaryCard
            title="Total Orders"
            value={String(filteredOrders.length)}
            icon={<PackageCheck className="w-5 h-5 text-sage-green" />}
          />

          <SummaryCard
            title="Total Amount"
            value={formatPKR(totalSpent)}
            icon={<ShoppingBag className="w-5 h-5 text-sage-green" />}
          />

          <SummaryCard
            title="Latest Status"
            value={filteredOrders[0]?.order_status || 'No Orders'}
            icon={<Clock className="w-5 h-5 text-sage-green" />}
          />
        </div>

        <div className="bg-white border border-brand-border/60 rounded-3xl p-5 shadow-sm mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div>
              <h2 className="text-xl font-black text-brand-dark">
                Search Orders
              </h2>

              <p className="text-sm text-slate-500 font-semibold mt-1">
                Search by order ID, customer name, phone, product or status.
              </p>
            </div>

            <div className="relative w-full lg:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search orders..."
                className="w-full bg-white border border-brand-border/60 rounded-xl py-3 pl-10 pr-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
              />
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm font-bold mb-8">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-brand-border/60 rounded-3xl p-12 text-center">
            <p className="text-sm font-black text-slate-700">
              Loading orders...
            </p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white border border-brand-border/60 rounded-3xl p-12 text-center">
            <ReceiptText className="w-12 h-12 text-slate-300 mx-auto mb-4" />

            <h3 className="text-xl font-black text-brand-dark">
              No orders found
            </h3>

            <p className="text-sm text-slate-500 font-semibold mt-2">
              Place an order first or clear search filters.
            </p>

            <button
              onClick={() => navigate('/shop')}
              className="mt-6 bg-brand-gold hover:opacity-90 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredOrders.map((order) => (
              <article
                key={order.id}
                className="bg-white border border-brand-border/60 rounded-3xl shadow-sm overflow-hidden"
              >
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-slate-100">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-black text-brand-dark">
                        Order {order.order_code || `WR-${order.id}`}
                      </h3>

                      <span
                        className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${getStatusStyle(order.order_status)}`}
                      >
                        {order.order_status}
                      </span>

                      <span className="px-3 py-1 rounded-full border border-brand-border/60 bg-cream-base text-slate-600 text-[10px] font-black uppercase tracking-wider">
                        {order.payment_status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 font-bold mt-2">
                      Placed on {formatDate(order.order_date)}
                    </p>
                  </div>

                  <button
                    onClick={() => downloadInvoicePDF(order)}
                    className="bg-slate-950 hover:bg-black text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                </div>

                <div className="p-5 grid grid-cols-1 lg:grid-cols-[55%_45%] gap-5">
                  <div className="flex flex-col gap-4 min-w-0">
                    {(order.items && order.items.length > 0 ? order.items : [order]).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-4 min-w-0 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                        <img
                          src={item.product_image_url || 'https://placehold.co/120x160?text=Wear+Right'}
                          alt={item.product_name}
                          className="w-20 h-24 rounded-2xl object-cover bg-cream-card/60 border border-brand-border/60 flex-shrink-0"
                          onError={(event) => {
                            event.currentTarget.src =
                              'https://placehold.co/120x160?text=Wear+Right';
                          }}
                        />

                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-widest text-sage-green font-black mb-1">
                            Product
                          </p>

                          <h4 className="text-lg font-black text-brand-dark line-clamp-1">
                            {item.product_name}
                          </h4>

                          <p className="text-xs text-slate-500 font-bold mt-1">
                            Quantity: {item.quantity}
                          </p>

                          <p className="text-xl font-black text-brand-dark mt-3">
                            {formatPKR(item.total_amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-cream-base border border-slate-100 rounded-2xl p-4">
                    <h4 className="text-sm font-black text-brand-dark mb-4">
                      Customer Details
                    </h4>

                    <div className="space-y-3">
                      <InfoLine label="Name" value={order.customer_name} />
                      <InfoLine label="Phone" value={order.customer_phone} />
                      <InfoLine label="Email" value={order.customer_email || 'Not provided'} />
                      <InfoLine label="Address" value={order.customer_address} />
                    </div>
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

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-brand-border/60 rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
            {title}
          </p>

          <p className="text-2xl font-black text-brand-dark mt-2">
            {value}
          </p>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-sage-green/10 flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400 flex-shrink-0">
        {label}
      </span>

      <span className="text-xs font-black text-slate-800 text-right break-words">
        {value}
      </span>
    </div>
  );
}