import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Brain,
  Camera,
  CheckCircle2,
  Layers,
  Shirt,
  Sparkles,
} from 'lucide-react';

export default function AboutView() {
  const navigate = useNavigate();

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-cream-base text-left font-sans">
      <section className="bg-slate-950 text-white px-6 py-20 relative overflow-hidden">
        <div className="absolute right-[-80px] top-[-80px] w-96 h-96 rounded-full bg-sage-green/100/20 blur-3xl" />

        <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-[60%_40%] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-sage-green/100/10 border border-blue-400/20 text-sage-green/80 px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-widest font-black">
                About Wear Right
              </span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight">
              AI-Based Skin Tone Style Selector
            </h1>

            <p className="text-sm sm:text-base text-slate-300 font-semibold leading-relaxed mt-6 max-w-3xl">
              Wear Right helps customers choose better outfits by detecting skin tone, matching suitable colors, and recommending complete outfit combinations from the product catalog.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/facescan')}
                className="bg-brand-gold hover:opacity-90 text-white px-6 py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
              >
                Start Face Scan
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => navigate('/shop')}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/10 px-6 py-4 rounded-xl text-xs font-black uppercase tracking-wider"
              >
                Browse Shop
              </button>
            </div>
          </div>

          <div className="bg-white/10 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
            <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center mb-6">
              <img
                src="/brand/wr-icon.png"
                alt="Wear Right"
                className="w-16 h-16 object-contain"
                onError={(event) => {
                  event.currentTarget.src = '/brand/wr-monogram.png';
                }}
              />
            </div>

            <h2 className="text-2xl font-black">
              Right Style. Right You.
            </h2>

            <p className="text-sm text-slate-300 font-semibold mt-3">
              A final year project focused on smart fashion recommendation, virtual outfit preview and personalized shopping.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <FeatureCard
              icon={<Camera className="w-6 h-6" />}
              title="Face Scan"
              description="Detects user skin tone using camera-based scan flow."
            />

            <FeatureCard
              icon={<Brain className="w-6 h-6" />}
              title="AI Logic"
              description="Uses recommendation rules to match colors and styles."
            />

            <FeatureCard
              icon={<Shirt className="w-6 h-6" />}
              title="Complete Outfit"
              description="Suggests shirt, pant, shoes and accessories."
            />

            <FeatureCard
              icon={<Layers className="w-6 h-6" />}
              title="Admin Catalog"
              description="Admin can manage products, orders and stock."
            />
          </div>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-brand-border/60 rounded-3xl p-8 shadow-sm">
              <h2 className="text-3xl font-black text-brand-dark">
                Project Purpose
              </h2>

              <p className="text-sm text-slate-600 font-semibold leading-relaxed mt-4">
                Online shopping can be confusing because customers often do not know which color or outfit style suits them. Wear Right reduces this confusion by using skin tone classification and fashion rules to recommend suitable products.
              </p>

              <div className="mt-6 space-y-3">
                <Point text="Reduce customer decision time." />
                <Point text="Improve fashion confidence." />
                <Point text="Recommend colors according to skin tone." />
                <Point text="Generate complete outfit combinations." />
              </div>
            </div>

            <div className="bg-white border border-brand-border/60 rounded-3xl p-8 shadow-sm">
              <h2 className="text-3xl font-black text-brand-dark">
                Technology Stack
              </h2>

              <p className="text-sm text-slate-600 font-semibold leading-relaxed mt-4">
                The project uses a modern full-stack architecture with React frontend, Django backend, PostgreSQL database and image-processing logic for face scan and skin tone detection.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                {['React', 'Django', 'PostgreSQL', 'OpenCV', 'REST API', 'Rule Engine'].map((item) => (
                  <div
                    key={item}
                    className="bg-cream-base border border-slate-100 rounded-xl px-4 py-3 text-sm font-black text-slate-800"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white border border-brand-border/60 rounded-3xl p-6 shadow-sm">
      <div className="w-14 h-14 rounded-2xl bg-sage-green/10 text-sage-green flex items-center justify-center mb-5">
        {icon}
      </div>

      <h3 className="text-lg font-black text-brand-dark">
        {title}
      </h3>

      <p className="text-sm text-slate-500 font-semibold leading-relaxed mt-2">
        {description}
      </p>
    </div>
  );
}

function Point({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
      <span className="text-sm font-bold text-slate-700">
        {text}
      </span>
    </div>
  );
}