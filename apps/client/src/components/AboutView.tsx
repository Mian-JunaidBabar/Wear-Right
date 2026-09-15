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
  User,
} from 'lucide-react';

export default function AboutView() {
  const navigate = useNavigate();

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-cream-base text-left font-sans">
      <section className="relative w-full overflow-hidden pt-4 pb-16 border-b border-brand-border/60 bg-slate-50">
        {/* Background ambient light gradients */}
        <div className="absolute right-[-100px] top-[-100px] w-96 h-96 bg-blue-100/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-[-100px] bottom-[-100px] w-96 h-96 bg-blue-50/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center pt-2 md:pt-4">
          {/* Hero Left Content Column */}
          <div className="lg:col-span-7 flex flex-col justify-start text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 w-max mb-6 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-brand-gold animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-blue-700 font-extrabold font-sans">
                Our Story
              </span>
            </div>

            <h1 className="font-serif tracking-tight text-brand-dark leading-[1.15] mb-6 text-4xl sm:text-5xl lg:text-[56px] font-normal">
              Redefining Fashion <br />
              <span className="text-blue-600 italic font-serif">
                With AI
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-500 mb-8 max-w-xl leading-relaxed font-sans font-medium">
              We believe everyone deserves to look their best. Wear Right combines AI technology with fashion expertise to help you discover styles that truly suit you.
            </p>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/facescan')}
                className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-4 text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2.5 rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-xl hover:shadow-blue-600/20 group cursor-pointer"
              >
                <Camera className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                Start Face Scan
              </button>

              <button
                onClick={() => navigate('/shop')}
                className="border border-brand-gold text-slate-800 hover:bg-slate-50 px-6 py-4 text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 rounded-xl cursor-pointer bg-transparent"
              >
                Browse Shop
                <ArrowRight className="w-4 h-4 text-brand-gold" />
              </button>
            </div>
          </div>

          {/* Hero Right Visual Column */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="w-full max-w-[380px] aspect-[3/4] bg-white border-2 border-brand-gold/15 shadow-[0_20px_50px_-12px_rgba(35,33,29,0.18)] rounded-[2rem] overflow-hidden group select-none transition-all duration-500 hover:border-brand-gold/30">
              <div className="absolute inset-0 bg-slate-950/5 pointer-events-none" />
              <img
                src="/brand/about-hero.jpg"
                alt="About Wear Right fashion model"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-103"
              />
              {/* Overlay logo badge */}
              <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md border border-slate-100 rounded-2xl p-4 shadow-xl max-w-[200px]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shadow-inner">
                    <img
                      src="/brand/wr-icon.png"
                      alt="Wear Right"
                      className="w-7 h-7 object-contain"
                      onError={(event) => {
                        event.currentTarget.src = '/brand/wr-monogram.png';
                      }}
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-brand-dark font-sans leading-tight">Wear Right</h4>
                    <p className="text-[9px] text-slate-400 font-sans mt-0.5">Style Calibration AI</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Mission Section */}
      <section className="w-full py-20 px-6 bg-white border-b border-brand-border/60">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[10px] uppercase tracking-widest text-blue-700 font-extrabold font-sans">
              Purpose & Focus
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-normal text-brand-dark mt-2">
              Our Mission
            </h2>
            <div className="w-12 h-1 bg-brand-gold mx-auto mt-4 rounded-full" />
          </div>

          {/* 2-Column Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left side: Mission statement paragraph */}
            <div className="flex flex-col text-left justify-center lg:pr-6">
              <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed font-sans">
                Online shopping often leaves customers confused with too many choices. Our mission is to simplify fashion decisions using AI-powered skin tone analysis and smart outfit matching, so every customer finds clothes that truly suit them — reducing returns and saving time.
              </p>
            </div>

            {/* Right side: Image or decorative element */}
            <div className="relative flex items-center justify-center">
              <div className="w-full max-w-[480px] aspect-[16/10] bg-slate-50 border-2 border-brand-gold/15 shadow-xl rounded-[1.5rem] overflow-hidden group select-none transition-all duration-500 hover:border-brand-gold/30">
                <div className="absolute inset-0 bg-slate-950/5 pointer-events-none" />
                <img
                  src="/brand/about-mission.png"
                  alt="Our Mission"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-103"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How We're Different Section */}
      <section className="w-full py-16 px-6 max-w-7xl mx-auto border-b border-brand-border/60">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-[10px] uppercase tracking-widest text-blue-700 font-extrabold font-sans">
            Why We Stand Out
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-normal text-brand-dark mt-2">
            How We're Different
          </h2>
          <div className="w-12 h-1 bg-brand-gold mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Card 1: AI Skin Tone Detection */}
          <div className="flex flex-col items-start text-left p-6 bg-white rounded-2xl border border-blue-200/60 shadow-sm hover:shadow-md transition-shadow relative">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-5">
              <Camera className="w-5 h-5 text-brand-gold" />
            </div>
            <h3 className="font-sans font-bold text-slate-800 text-base mb-2">
              AI Skin Tone Detection
            </h3>
            <p className="text-xs text-slate-500 font-sans leading-relaxed">
              Advanced scanning technology detects your unique skin tone in seconds
            </p>
          </div>

          {/* Card 2: Smart Outfit Matching */}
          <div className="flex flex-col items-start text-left p-6 bg-white rounded-2xl border border-blue-200/60 shadow-sm hover:shadow-md transition-shadow relative">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-5">
              <Layers className="w-5 h-5 text-brand-gold" />
            </div>
            <h3 className="font-sans font-bold text-slate-800 text-base mb-2">
              Smart Outfit Matching
            </h3>
            <p className="text-xs text-slate-500 font-sans leading-relaxed">
              Get complete outfit suggestions, not just single items
            </p>
          </div>

          {/* Card 3: Reduced Returns */}
          <div className="flex flex-col items-start text-left p-6 bg-white rounded-2xl border border-blue-200/60 shadow-sm hover:shadow-md transition-shadow relative">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-5">
              <CheckCircle2 className="w-5 h-5 text-brand-gold" />
            </div>
            <h3 className="font-sans font-bold text-slate-800 text-base mb-2">
              Reduced Returns
            </h3>
            <p className="text-xs text-slate-500 font-sans leading-relaxed">
              Shop with confidence knowing items suit you
            </p>
          </div>

          {/* Card 4: Virtual Mannequin Preview */}
          <div className="flex flex-col items-start text-left p-6 bg-white rounded-2xl border border-blue-200/60 shadow-sm hover:shadow-md transition-shadow relative">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-5">
              <User className="w-5 h-5 text-brand-gold" />
            </div>
            <h3 className="font-sans font-bold text-slate-800 text-base mb-2">
              Virtual Mannequin Preview
            </h3>
            <p className="text-xs text-slate-500 font-sans leading-relaxed">
              Preview your complete outfit on an AI-generated mannequin before making your purchase.
            </p>
          </div>
        </div>
      </section>

      {/* Meet Our Team Section */}
      <section className="w-full py-20 px-6 bg-white border-b border-brand-border/60">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-[10px] uppercase tracking-widest text-blue-700 font-extrabold font-sans">
              The Creators
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-normal text-brand-dark mt-2">
              Meet Our Team
            </h2>
            <div className="w-12 h-1 bg-brand-gold mx-auto mt-4 rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Member 1: Hammad Ahmad */}
            <div className="flex flex-col items-center text-center p-8 bg-white rounded-2xl border border-blue-200/60 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02]">
              <div className="w-20 h-20 rounded-full bg-blue-600 text-white border-4 border-blue-50 flex items-center justify-center font-display font-bold text-2xl mb-6 shadow-md shadow-blue-900/10">
                HA
              </div>
              <h3 className="font-serif font-normal text-brand-dark text-lg mb-1">
                Hammad Ahmad
              </h3>
              <p className="text-xs text-brand-gold font-sans font-bold uppercase tracking-wider">
                Founder & Developer
              </p>
              <p className="text-xs text-slate-500 font-sans mt-3.5 leading-relaxed">
                Leads software development, AI model integrations, and backend architecture of Style Calibration.
              </p>
            </div>

            {/* Member 2: Ali Tariq */}
            <div className="flex flex-col items-center text-center p-8 bg-white rounded-2xl border border-blue-200/60 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02]">
              <div className="w-20 h-20 rounded-full bg-blue-700 text-white border-4 border-blue-50 flex items-center justify-center font-display font-bold text-2xl mb-6 shadow-md shadow-blue-900/10">
                AT
              </div>
              <h3 className="font-serif font-normal text-brand-dark text-lg mb-1">
                Ali Tariq
              </h3>
              <p className="text-xs text-brand-gold font-sans font-bold uppercase tracking-wider">
                UI/UX Designer
              </p>
              <p className="text-xs text-slate-500 font-sans mt-3.5 leading-relaxed">
                Crafts the premium brand visual identity, designs style curation interfaces, and maintains seamless web flows.
              </p>
            </div>

            {/* Member 3: Sameer Ahmad */}
            <div className="flex flex-col items-center text-center p-8 bg-white rounded-2xl border border-blue-200/60 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02]">
              <div className="w-20 h-20 rounded-full bg-blue-800 text-white border-4 border-blue-50 flex items-center justify-center font-display font-bold text-2xl mb-6 shadow-md shadow-blue-900/10">
                SA
              </div>
              <h3 className="font-serif font-normal text-brand-dark text-lg mb-1">
                Sameer Ahmad
              </h3>
              <p className="text-xs text-brand-gold font-sans font-bold uppercase tracking-wider">
                Co-Developer & QA
              </p>
              <p className="text-xs text-slate-500 font-sans mt-3.5 leading-relaxed">
                Manages catalog intelligence validation, system deployment auditing, and rule engines quality assurance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* High-Impact CTA Section */}
      <section className="w-full py-12 px-6 max-w-7xl mx-auto mt-6 mb-12">
        <div className="bg-blue-600 rounded-[32px] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-8 border border-blue-700/50">

          {/* Subtle background abstract shapes */}
          <div className="absolute -right-10 -bottom-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 top-10 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Left Text Column */}
          <div className="flex flex-col items-start text-left max-w-xl relative z-10">
            <span className="text-[10px] uppercase tracking-widest text-brand-gold font-extrabold font-sans mb-3">
              AI Style Calibration
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-normal text-white mb-3 leading-tight">
              Ready to Find Your Perfect Style?
            </h2>
            <p className="text-xs sm:text-sm text-slate-100 font-sans leading-relaxed max-w-md">
              Start your AI-powered fashion journey today. Calibration will analyze your skin parameters and recommend colors.
            </p>
          </div>

          {/* Right Buttons Column */}
          <div className="flex flex-wrap gap-4 relative z-10 shrink-0">
            <button
              onClick={() => navigate('/facescan')}
              className="bg-white text-blue-900 hover:bg-slate-50 px-8 py-4 text-xs font-black uppercase tracking-wider transition-all duration-300 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center gap-2 cursor-pointer border-none group"
            >
              <Camera className="w-4 h-4 text-blue-700 group-hover:scale-110 transition-transform" />
              Scan Your Face
            </button>

            <button
              onClick={() => navigate('/shop')}
              className="bg-blue-700/40 text-white hover:bg-blue-700/60 border border-white/20 px-8 py-4 text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 rounded-xl cursor-pointer"
            >
              Browse Shop
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}