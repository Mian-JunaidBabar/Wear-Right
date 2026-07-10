import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Heart,
  ShoppingBag,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { CartProduct } from '../App';

type WishlistViewProps = {
  wishlistItems: CartProduct[];
  removeFromWishlist: (productId: number | string) => void;
  addToCart: (product: CartProduct) => void;
};

function formatPKR(value: string | number | undefined) {
  const num = Number(value || 0);
  return `Rs. ${num.toLocaleString('en-PK')}`;
}

function getProductImage(product: CartProduct) {
  return (
    product.image_url ||
    product.image ||
    'https://placehold.co/300x400?text=Wear+Right'
  );
}

export default function WishlistView({
  wishlistItems,
  removeFromWishlist,
  addToCart,
}: WishlistViewProps) {
  const navigate = useNavigate();

  const handleAddToCart = (product: CartProduct) => {
    if (
      Number(product.stock_quantity || 0) <= 0 ||
      product.status === 'Out of Stock' ||
      product.status === 'Inactive'
    ) {
      alert('This product is currently out of stock.');
      return;
    }

    addToCart(product);
  };

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-cream-base px-6 py-10 text-left font-sans">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate('/shop')}
          className="mb-6 bg-white hover:bg-cream-card/60 border border-brand-border/60 text-slate-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Shop
        </button>

        <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-red-600 font-black mb-2">
              Saved Products
            </p>

            <h1 className="text-3xl sm:text-5xl font-black text-brand-dark tracking-tight">
              My Wishlist
            </h1>

            <p className="text-sm text-slate-500 font-semibold mt-3 max-w-2xl">
              Your saved products appear here. You can view details, add them to cart or remove them anytime.
            </p>
          </div>

          <div className="bg-white border border-brand-border/60 rounded-2xl px-5 py-4 shadow-sm">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
              Total Saved
            </p>

            <p className="text-2xl font-black text-brand-dark mt-1">
              {wishlistItems.length}
            </p>
          </div>
        </div>

        {wishlistItems.length === 0 ? (
          <div className="bg-white border border-brand-border/60 rounded-3xl p-12 text-center shadow-sm">
            <Heart className="w-16 h-16 text-slate-300 mx-auto mb-4" />

            <h2 className="text-2xl font-black text-brand-dark">
              Wishlist is Empty
            </h2>

            <p className="text-sm text-slate-500 font-semibold mt-3">
              Save products from shop to view them here later.
            </p>

            <button
              onClick={() => navigate('/shop')}
              className="mt-6 bg-brand-gold hover:opacity-90 text-white px-6 py-4 rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              Continue Shopping
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {wishlistItems.map((product) => (
              <article
                key={product.id}
                className="bg-white border border-brand-border/60 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all"
              >
                <button
                  onClick={() => navigate(`/product/${product.id}`)}
                  className="w-full aspect-[3/4] bg-cream-card/60 overflow-hidden"
                >
                  <img
                    src={getProductImage(product)}
                    alt={product.name}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                    onError={(event) => {
                      event.currentTarget.src =
                        'https://placehold.co/300x400?text=Wear+Right';
                    }}
                  />
                </button>

                <div className="p-5">
                  <div className="flex items-center justify-between gap-2 text-[10px] uppercase text-slate-400 font-black mb-2">
                    <span>{product.style || product.cultural_tag || 'Casual'}</span>
                    <span>{product.color || product.compatible_skin_tone || 'N/A'}</span>
                  </div>

                  <h3 className="text-sm font-black text-brand-dark line-clamp-1">
                    {product.name}
                  </h3>

                  <p className="text-xs text-slate-500 font-bold mt-1">
                    {product.category}
                  </p>

                  <p className="text-xl font-black text-brand-dark mt-4">
                    {formatPKR(product.price)}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleAddToCart(product)}
                      className="bg-brand-gold hover:opacity-90 text-white py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Cart
                    </button>

                    <button
                      onClick={() => removeFromWishlist(product.id)}
                      className="bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
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