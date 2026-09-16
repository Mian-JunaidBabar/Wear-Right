import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Camera,
  Compass,
  TrendingUp,
  Sparkles,
  Filter,
  Layers,
  HelpCircle,
  ArrowRight,
  Shirt,
  ScanFace,
  CheckCircle2,
  LayoutGrid,
  Target,
  Users,
  ShoppingBag,
  Truck,
  RotateCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ViewType } from "../types";
import FeaturedCarousel from "./FeaturedCarousel";
import { API_ENDPOINTS, getProductImageUrl } from "../config/api";

interface HomeViewProps {
  setView: (view: ViewType) => void;
}

export default function HomeView({ setView }: HomeViewProps) {
  const navigate = useNavigate();
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCoords({
        x: (e.clientX / window.innerWidth - 0.5) * 15,
        y: (e.clientY / window.innerHeight - 0.5) * 15,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.products);
        if (response.ok) {
          const data = await response.json();
          setFeaturedProducts((data.products || []).slice(0, 4));
        }
      } catch (err) {
        console.error("Error fetching featured products:", err);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, []);

  const getProductImage = (imagePath?: string | null) => {
    if (!imagePath) return "/placeholder.png";
    if (imagePath.startsWith("http")) return imagePath;
    return `http://127.0.0.1:8000${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
    return getProductImageUrl(imagePath);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" as const },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full bg-slate-50 min-h-screen text-slate-900 pb-20 font-sans"
    >
      {/* Hero Header Area */}
      <section className="relative w-full overflow-hidden pt-0 pb-16 md:pb-20">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pt-12 md:pt-16">
          {/* Hero Left Content Column */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-5 flex flex-col justify-start text-left"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 w-max mb-6">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-blue-700 font-extrabold font-sans">
                AI-Powered Fashion
              </span>
            </div>

            <h1 className="font-serif tracking-tight text-slate-900 leading-[1.15] mb-6 text-4xl sm:text-5xl lg:text-[56px] font-normal">
              Find Your <br />
              Perfect Outfit <br />
              <span className="text-blue-600 italic font-serif">with AI</span>
              <span className="text-blue-600 italic font-serif">with AI</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-500 mb-8 max-w-md leading-relaxed font-sans font-medium">
              Scan your skin tone and discover clothing that suits you best.
            </p>

            <div className="flex flex-wrap gap-4 mb-10">
              <button
                onClick={() => setView("facescan")}
                className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-4 text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2.5 rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-xl hover:shadow-blue-600/20 group cursor-pointer"
              >
                <Camera className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                Start Face Scan
              </button>

              <button
                onClick={() => setView("shop")}
                className="border border-brand-gold text-slate-800 hover:bg-slate-50 px-6 py-4 text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 rounded-xl cursor-pointer bg-transparent"
              >
                Explore Collection
                <ArrowRight className="w-4 h-4 text-brand-gold" />
              </button>
            </div>
          </motion.div>

          {/* Hero Right Visual Column */}
          <motion.div
            variants={itemVariants}
            className="lg:col-span-7 relative flex items-start justify-end lg:-ml-12 lg:-mt-18"
          >
            <div className="w-full aspect-[815/660] relative overflow-hidden group">
              {/* Soft gradient overlay to blend image left edge with page background */}
              <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none" />
              {/* Soft gradient overlay to blend image right edge with page background */}
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none" />
              <img
                src="/brand/hero-models-v7.png"
                alt="Wear Right couple models styled with AI"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-101"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Floating Trust & Performance Metrics Banner */}
      <motion.section
        variants={itemVariants}
        className="max-w-7xl mx-auto px-6 -mt-24 mb-12 relative z-10"
      >
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-100/50 grid grid-cols-2 md:grid-cols-4 gap-6 items-center divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Item 1 */}
          <div className="flex items-center gap-4 justify-start px-2">
            <div className="p-3 bg-slate-50 rounded-xl text-blue-600">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-xl sm:text-2xl font-black font-display text-slate-900">
                1000+
              </p>
              <p className="text-xs text-slate-400 font-bold font-sans">
                Premium Products
              </p>
              <p className="text-xl sm:text-2xl font-black font-display text-slate-900">
                1000+
              </p>
              <p className="text-xs text-slate-400 font-bold font-sans">
                Premium Products
              </p>
            </div>
          </div>

          {/* Item 2 */}
          <div className="flex items-center gap-4 justify-start px-2 pt-4 md:pt-0 md:pl-6">
            <div className="p-3 bg-slate-50 rounded-xl text-blue-600">
              <Target className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-xl sm:text-2xl font-black font-display text-slate-900">
                95%
              </p>
              <p className="text-xs text-slate-400 font-bold font-sans">
                Match Accuracy
              </p>
              <p className="text-xl sm:text-2xl font-black font-display text-slate-900">
                95%
              </p>
              <p className="text-xs text-slate-400 font-bold font-sans">
                Match Accuracy
              </p>
            </div>
          </div>

          {/* Item 3 */}
          <div className="flex items-center gap-4 justify-start px-2 pt-4 md:pt-0 md:pl-6">
            <div className="p-3 bg-slate-50 rounded-xl text-blue-600">
              <Users className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-xl sm:text-2xl font-black font-display text-slate-900">
                500+
              </p>
              <p className="text-xs text-slate-400 font-bold font-sans">
                Happy Customers
              </p>
              <p className="text-xl sm:text-2xl font-black font-display text-slate-900">
                500+
              </p>
              <p className="text-xs text-slate-400 font-bold font-sans">
                Happy Customers
              </p>
            </div>
          </div>

          {/* Item 4 */}
          <div className="flex items-center gap-4 justify-start px-2 pt-4 md:pt-0 md:pl-6">
            <div className="p-3 bg-slate-50 rounded-xl text-blue-600">
              <Shirt className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="text-xl sm:text-2xl font-black font-display text-slate-900">
                50+
              </p>
              <p className="text-xs text-slate-400 font-bold font-sans">
                Outfit Combinations
              </p>
              <p className="text-xl sm:text-2xl font-black font-display text-slate-900">
                50+
              </p>
              <p className="text-xs text-slate-400 font-bold font-sans">
                Outfit Combinations
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* How It Works Section */}
      <section className="w-full py-16 px-6 max-w-7xl mx-auto border-t border-slate-200/50 mt-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-extrabold font-sans">
            Simple Process
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-normal text-slate-900 mt-2">
            How It Works
          </h2>
          <div className="w-12 h-1 bg-brand-gold mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {/* Connecting line for desktop */}
          <div className="hidden lg:block absolute top-[45px] left-[12.5%] right-[12.5%] h-0.5 bg-slate-200/60 -z-10" />

          {/* Step 1 */}
          <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow relative">
            <div className="absolute -top-4 left-6 bg-emerald-600 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-md">
              01
            </div>
            <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-emerald-600 mb-6 mt-2">
              <Camera className="w-6 h-6" />
            </div>
            <h3 className="font-sans font-bold text-slate-800 text-base mb-2">
              Scan Your Face
            </h3>
            <h3 className="font-sans font-bold text-slate-800 text-base mb-2">
              Scan Your Face
            </h3>
            <p className="text-xs text-slate-500 font-sans leading-relaxed">
              Use your camera to capture a quick, high-precision biometric scan
              of your face. Use your camera to capture a quick, high-precision
              biometric scan of your face.
            </p>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow relative">
            <div className="absolute -top-4 left-6 bg-emerald-600 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-md">
              02
            </div>
            <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-emerald-600 mb-6 mt-2">
              <ScanFace className="w-6 h-6" />
            </div>
            <h3 className="font-sans font-bold text-slate-800 text-base mb-2">
              Get Skin Tone Detected
            </h3>
            <h3 className="font-sans font-bold text-slate-800 text-base mb-2">
              Get Skin Tone Detected
            </h3>
            <p className="text-xs text-slate-500 font-sans leading-relaxed">
              Our advanced AI detects your unique skin undertone and contrast
              parameters. Our advanced AI detects your unique skin undertone and
              contrast parameters.
            </p>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow relative">
            <div className="absolute -top-4 left-6 bg-emerald-600 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-md">
              03
            </div>
            <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-emerald-600 mb-6 mt-2">
              <Shirt className="w-6 h-6" />
            </div>
            <h3 className="font-sans font-bold text-slate-800 text-base mb-2">
              Receive Outfit Recommendations
            </h3>
            <h3 className="font-sans font-bold text-slate-800 text-base mb-2">
              Receive Outfit Recommendations
            </h3>
            <p className="text-xs text-slate-500 font-sans leading-relaxed">
              Get an instantly curated selection of colors and clothes matching
              your profile. Get an instantly curated selection of colors and
              clothes matching your profile.
            </p>
          </div>

          {/* Step 4 */}
          <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow relative">
            <div className="absolute -top-4 left-6 bg-emerald-600 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-md">
              04
            </div>
            <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-emerald-600 mb-6 mt-2">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="font-sans font-bold text-slate-800 text-base mb-2">
              Shop & Complete Your Look
            </h3>
            <h3 className="font-sans font-bold text-slate-800 text-base mb-2">
              Shop & Complete Your Look
            </h3>
            <p className="text-xs text-slate-500 font-sans leading-relaxed">
              Browse matching pairs, view recommendations, and purchase your
              customized outfits. Browse matching pairs, view recommendations,
              and purchase your customized outfits.
            </p>
          </div>
        </div>
      </section>

      {/* Shop By Category Section */}
      <section className="w-full py-16 px-6 max-w-7xl mx-auto border-t border-slate-200/50 mt-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-extrabold font-sans">
            Curated Collections
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-normal text-slate-900 mt-2">
            Shop By Category
          </h2>
          <div className="w-12 h-1 bg-brand-gold mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Men Category Card */}
          <div
            onClick={() => navigate("/shop?gender=Men")}
            className="group relative h-96 rounded-2xl overflow-hidden shadow-lg cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
          >
            <img
              src="/category-images/men-shirt.jpg"
              alt="Men's Fashion Category"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Elegant overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/40 to-transparent transition-colors group-hover:via-slate-900/50" />
            <div className="absolute bottom-8 left-8 text-left z-10">
              <span className="text-[10px] uppercase tracking-wider text-brand-gold font-extrabold font-sans">
                Tailored Classics
              </span>
              <h3 className="text-3xl font-serif font-normal text-white mt-1 mb-4">
                Men
              </h3>
              <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-slate-900 font-sans font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-50 transition-colors">
                Explore Collection
                <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
              </span>
            </div>
          </div>

          {/* Women Category Card */}
          <div
            onClick={() => navigate("/shop?gender=Women")}
            className="group relative h-96 rounded-2xl overflow-hidden shadow-lg cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
          >
            <img
              src="/category-images/women-kurta.jpg"
              alt="Women's Fashion Category"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Elegant overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/40 to-transparent transition-colors group-hover:via-slate-900/50" />
            <div className="absolute bottom-8 left-8 text-left z-10">
              <span className="text-[10px] uppercase tracking-wider text-brand-gold font-extrabold font-sans">
                Contemporary Couture
              </span>
              <h3 className="text-3xl font-serif font-normal text-white mt-1 mb-4">
                Women
              </h3>
              <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-slate-900 font-sans font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-50 transition-colors">
                Explore Collection
                <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="w-full py-16 px-6 max-w-7xl mx-auto border-t border-slate-200/50 mt-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-extrabold font-sans">
            Latest Arrivals
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-normal text-slate-900 mt-2">
            Featured Products
          </h2>
          <div className="w-12 h-1 bg-brand-gold mx-auto mt-4 rounded-full" />
        </div>

        {loadingProducts ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
              {featuredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => navigate(`/product/${product.id}`)}
                  className="group flex flex-col p-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 cursor-pointer text-left"
                >
                  <div className="w-full aspect-[4/5] rounded-xl overflow-hidden bg-slate-50 relative mb-4">
                    <img
                      src={getProductImage(product.image)}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-103"
                    />
                  </div>
                  <h3 className="font-sans font-bold text-sm text-slate-800 line-clamp-1 mb-1">
                    {product.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-sans font-bold mb-2 uppercase">
                    {product.category || "Couture"}
                  </p>
                  <p className="font-sans font-black text-sm text-emerald-700 mt-auto">
                    Rs. {Number(product.price || 0).toLocaleString("en-PK")}
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setView("shop")}
              className="mt-12 bg-emerald-600 text-white hover:bg-emerald-700 px-8 py-4 text-xs font-black uppercase tracking-wider transition-all duration-300 rounded-xl shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer border-none"
            >
              View All Products
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>
        )}
      </section>

      {/* High-Impact CTA Face Scan Banner */}
      <section className="w-full py-12 px-6 max-w-7xl mx-auto">
        <div className="bg-emerald-600 rounded-[32px] p-8 md:p-12 text-white relative overflow-hidden shadow-xl flex flex-col lg:flex-row items-center justify-between gap-8 border border-emerald-700/50">
          {/* Subtle background abstract shapes */}
          <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 top-10 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Left Text & Button Column */}
          <div className="flex flex-col items-start text-left max-w-xl relative z-10">
            <span className="text-[10px] uppercase tracking-widest text-brand-gold font-extrabold font-sans mb-3">
              AI Calibration
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-normal text-white mb-4 leading-tight">
              Not Sure What Suits You?
            </h2>
            <p className="text-sm text-slate-100 font-sans leading-relaxed mb-8 max-w-md">
              Let our system analyze your unique parameters to match you with
              custom seasonal palettes and optimal outfit recommendations. Let
              our system analyze your unique parameters to match you with custom
              seasonal palettes and optimal outfit recommendations.
            </p>
            <button
              onClick={() => setView("facescan")}
              className="bg-white text-emerald-800 hover:bg-slate-50 px-8 py-4 text-xs font-black uppercase tracking-wider transition-all duration-300 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center gap-2 cursor-pointer border-none group"
            >
              <Camera className="w-4 h-4 text-emerald-700 group-hover:scale-110 transition-transform" />
              Scan Your Face Now
            </button>
          </div>

          {/* Right Swatches Card */}
          <div className="w-full lg:w-auto min-w-[320px] bg-emerald-700/30 backdrop-blur-md rounded-2xl p-6 border border-emerald-500/20 relative z-10">
            <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-brand-gold mb-6 text-left">
              Example Skin Tone Palettes
            </h4>

            <div className="flex flex-col gap-5">
              {/* Fair Swatch */}
              <div className="flex items-center justify-between gap-6 border-b border-emerald-500/10 pb-3">
                <span className="text-xs font-sans font-bold text-slate-200">
                  Fair Tone
                </span>
                <span className="text-xs font-sans font-bold text-slate-200">
                  Fair Tone
                </span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#FCD5C8]"
                    title="Soft Peach"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#D4E6F1]"
                    title="Powder Blue"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#E6DCD2]"
                    title="Desert Sand"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#FCD5C8]"
                    title="Soft Peach"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#D4E6F1]"
                    title="Powder Blue"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#E6DCD2]"
                    title="Desert Sand"
                  />
                </div>
              </div>

              {/* Medium Swatch */}
              <div className="flex items-center justify-between gap-6 border-b border-emerald-500/10 pb-3">
                <span className="text-xs font-sans font-bold text-slate-200">
                  Medium Tone
                </span>
                <span className="text-xs font-sans font-bold text-slate-200">
                  Medium Tone
                </span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#C87A53]"
                    title="Warm Terracotta"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#6E8B3D]"
                    title="Olive Drab"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#D4AF37]"
                    title="Warm Gold"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#C87A53]"
                    title="Warm Terracotta"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#6E8B3D]"
                    title="Olive Drab"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#D4AF37]"
                    title="Warm Gold"
                  />
                </div>
              </div>

              {/* Dark Swatch */}
              <div className="flex items-center justify-between gap-6">
                <span className="text-xs font-sans font-bold text-slate-200">
                  Dark Tone
                </span>
                <span className="text-xs font-sans font-bold text-slate-200">
                  Dark Tone
                </span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#004B23]"
                    title="Deep Emerald"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#0A1128]"
                    title="Obsidian Midnight"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#5F0F40]"
                    title="Rich Burgundy"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#004B23]"
                    title="Deep Emerald"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#0A1128]"
                    title="Obsidian Midnight"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 bg-[#5F0F40]"
                    title="Rich Burgundy"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="w-full py-16 px-6 max-w-7xl mx-auto border-t border-slate-200/50 mt-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-extrabold font-sans">
            Our Promises
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-normal text-slate-900 mt-2">
            Why Choose Us
          </h2>
          <div className="w-12 h-1 bg-brand-gold mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Card 1: Personalized Recommendations */}
          <div className="flex flex-col items-start text-left p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow relative">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-5">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-sans font-bold text-slate-800 text-base mb-2">
              Personalized Recommendations
            </h3>
            <p className="text-xs text-slate-500 font-sans leading-relaxed">
              Our advanced AI detects your exact skin tone profile to calibrate
              perfect clothing matches. Our advanced AI detects your exact skin
              tone profile to calibrate perfect clothing matches.
            </p>
          </div>

          {/* Card 2: Reduced Returns */}
          <div className="flex flex-col items-start text-left p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow relative">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-5">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h3 className="font-sans font-bold text-slate-800 text-base mb-2">
              Reduced Returns
            </h3>
            <p className="text-xs text-slate-500 font-sans leading-relaxed">
              Know exactly how each garment matches your profile before ordering
              to eliminate sizing and color mismatch returns. Know exactly how
              each garment matches your profile before ordering to eliminate
              sizing and color mismatch returns.
            </p>
          </div>

          {/* Card 3: Complete Outfit Matching */}
          <div className="flex flex-col items-start text-left p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow relative">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-5">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-sans font-bold text-slate-800 text-base mb-2">
              Complete Outfit Matching
            </h3>
            <p className="text-xs text-slate-500 font-sans leading-relaxed">
              Don't buy single items. Build matching sets of tops, bottoms, and
              accessories tailored to your skin tone. Don't buy single items.
              Build matching sets of tops, bottoms, and accessories tailored to
              your skin tone.
            </p>
          </div>

          {/* Card 4: Fast Delivery */}
          <div className="flex flex-col items-start text-left p-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow relative">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-5">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="font-sans font-bold text-slate-800 text-base mb-2">
              Fast Delivery
            </h3>
            <p className="text-xs text-slate-500 font-sans leading-relaxed">
              Enjoy express packaging and quick courier dispatch to receive your
              tailored wardrobe right at your doorstep. Enjoy express packaging
              and quick courier dispatch to receive your tailored wardrobe right
              at your doorstep.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="w-full py-16 px-6 max-w-7xl mx-auto border-t border-slate-200/50 mt-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-extrabold font-sans">
            User Stories
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-normal text-slate-900 mt-2">
            Testimonials
          </h2>
          <p className="text-xs text-slate-500 font-sans mt-2 font-medium">
            See what our users say about their experience with Wear Right.
          </p>
          <div className="w-12 h-1 bg-brand-gold mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1: Hammad Ch */}
          <div className="flex flex-col p-8 bg-[#FAF7F2] rounded-2xl border border-slate-200/40 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 text-left h-full">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-700 flex items-center justify-center text-white font-sans font-bold text-sm shadow-inner animate-fade-in">
                HC
              </div>
              <div>
                <h4 className="font-sans font-extrabold text-sm text-slate-800">
                  Hammad Ch
                </h4>
                <h4 className="font-sans font-extrabold text-sm text-slate-800">
                  Hammad Ch
                </h4>
                <div className="flex gap-0.5 mt-1 text-emerald-600 text-xs">
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 font-sans leading-relaxed italic">
              "The AI accurately detected my skin tone and recommended outfits
              that suited me perfectly. Shopping has never been this easy." "The
              AI accurately detected my skin tone and recommended outfits that
              suited me perfectly. Shopping has never been this easy."
            </p>
          </div>

          {/* Card 2: Ali Tariq */}
          <div className="flex flex-col p-8 bg-[#FAF7F2] rounded-2xl border border-slate-200/40 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 text-left h-full">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-700 flex items-center justify-center text-white font-sans font-bold text-sm shadow-inner animate-fade-in">
                AT
              </div>
              <div>
                <h4 className="font-sans font-extrabold text-sm text-slate-800">
                  Ali Tariq
                </h4>
                <h4 className="font-sans font-extrabold text-sm text-slate-800">
                  Ali Tariq
                </h4>
                <div className="flex gap-0.5 mt-1 text-emerald-600 text-xs">
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 font-sans leading-relaxed italic">
              "I loved the personalized outfit suggestions. The complete outfit
              matching feature saved me a lot of time." "I loved the
              personalized outfit suggestions. The complete outfit matching
              feature saved me a lot of time."
            </p>
          </div>

          {/* Card 3: Sameer Ahmad */}
          <div className="flex flex-col p-8 bg-[#FAF7F2] rounded-2xl border border-slate-200/40 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 text-left h-full">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-700 flex items-center justify-center text-white font-sans font-bold text-sm shadow-inner animate-fade-in">
                SA
              </div>
              <div>
                <h4 className="font-sans font-extrabold text-sm text-slate-800">
                  Sameer Ahmad
                </h4>
                <h4 className="font-sans font-extrabold text-sm text-slate-800">
                  Sameer Ahmad
                </h4>
                <div className="flex gap-0.5 mt-1 text-emerald-600 text-xs">
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                  <span>⭐</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 font-sans leading-relaxed italic">
              "Great experience! The recommendations were accurate, and I found
              the perfect outfit within minutes." "Great experience! The
              recommendations were accurate, and I found the perfect outfit
              within minutes."
            </p>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
