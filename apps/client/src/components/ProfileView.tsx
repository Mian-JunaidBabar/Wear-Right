import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  ClipboardList,
  Heart,
  Info,
  Phone,
} from 'lucide-react';
import { UserState } from '../types';

interface ProfileViewProps {
  user: UserState;
  setUser: React.Dispatch<React.SetStateAction<UserState>>;
}

interface Swatch {
  name: string;
  hex: string;
  checked?: boolean;
}

const INITIAL_PALETTES: Swatch[][] = [
  [
    { name: 'Alabaster', hex: '#EAE6DF', checked: false },
    { name: 'Mushroom', hex: '#C1B7AD', checked: true },
    { name: 'Sage Mist', hex: '#8A8F8D', checked: false },
    { name: 'Obsidian', hex: '#2F3130', checked: true },
    { name: 'Espresso', hex: '#533A30', checked: false },
    { name: 'Crimson Earth', hex: '#9C3831', checked: false },
  ],
  [
    { name: 'Cognac', hex: '#9E5B40', checked: true },
    { name: 'Oatmeal', hex: '#E2D3C4', checked: true },
    { name: 'Moss Green', hex: '#5B6953', checked: false },
    { name: 'Parchment', hex: '#F0EBE1', checked: false },
    { name: 'Ink Blue', hex: '#2A3439', checked: false },
    { name: 'Charcoal', hex: '#4A4A4A', checked: true },
  ],
  [
    { name: 'Bone', hex: '#E3DFD5', checked: true },
    { name: 'Warm Clay', hex: '#BD6D54', checked: false },
    { name: 'Slate Gray', hex: '#636F73', checked: true },
    { name: 'Deep Sage', hex: '#4F5D54', checked: false },
    { name: 'Dune Sand', hex: '#D2B9A1', checked: true },
    { name: 'Tar Black', hex: '#1C1D21', checked: false },
  ],
];

export default function ProfileView({ user }: ProfileViewProps) {
  const navigate = useNavigate();

  const [selectedStyles, setSelectedStyles] = useState<string[]>([
    'Eastern',
    'Casual',
  ]);

  const [paletteIndex, setPaletteIndex] = useState(0);
  const [currentPalette, setCurrentPalette] = useState<Swatch[]>(
    INITIAL_PALETTES[0]
  );

  const [height, setHeight] = useState('178');
  const [chest, setChest] = useState('96');
  const [waist, setWaist] = useState('78');

  const toggleStyle = (style: string) => {
    if (selectedStyles.includes(style)) {
      if (selectedStyles.length > 1) {
        setSelectedStyles(selectedStyles.filter((item) => item !== style));
      }
    } else {
      setSelectedStyles([...selectedStyles, style]);
    }
  };

  const regeneratePalette = () => {
    const nextIdx = (paletteIndex + 1) % INITIAL_PALETTES.length;
    setPaletteIndex(nextIdx);
    setCurrentPalette(INITIAL_PALETTES[nextIdx]);
  };

  const toggleSwatchChecked = (idx: number) => {
    const updated = [...currentPalette];
    updated[idx].checked = !updated[idx].checked;
    setCurrentPalette(updated);
  };

  const activeStylesText =
    selectedStyles.length > 0 ? selectedStyles.join(' and ') : 'Casual';

  return (
    <div className="w-full bg-cream-base pb-24 text-left font-sans">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <header className="mb-8 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-sage-green/10 border border-brand-border/40 text-sage-green rounded-full mb-6 select-none font-sans">
            <Sparkles className="w-3.5 h-3.5 text-sage-green" />
            <span className="text-[10px] font-bold tracking-widest uppercase font-sans">
              AI Stylist Tuning Active
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-brand-dark mb-4 tracking-tight leading-none">
            Your Aesthetic Blueprint
          </h1>

          <p className="text-sm text-slate-500 leading-relaxed max-w-2xl font-sans font-medium">
            Refine your digital wardrobe parameters. The stylist engine cross-checks these visual coordinates with physical dimensions to recommend better outfits.
          </p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <QuickAction
            title="My Orders"
            description="View placed orders and invoices"
            icon={<ClipboardList className="w-5 h-5" />}
            onClick={() => navigate('/my-orders')}
          />

          <QuickAction
            title="Wishlist"
            description="Saved products for later"
            icon={<Heart className="w-5 h-5" />}
            onClick={() => navigate('/wishlist')}
          />

          <QuickAction
            title="About Wear Right"
            description="Learn about the project"
            icon={<Info className="w-5 h-5" />}
            onClick={() => navigate('/about')}
          />

          <QuickAction
            title="Contact Support"
            description="Get help from admin"
            icon={<Phone className="w-5 h-5" />}
            onClick={() => navigate('/contact')}
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <section className="lg:col-span-7 bg-white p-8 rounded-2xl border border-brand-border/60 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display font-semibold text-brand-dark">
                  Style Archetypes
                </h3>

                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">
                  Select parameters
                </span>
              </div>

              <p className="text-xs text-slate-500 max-w-md leading-relaxed mb-8">
                Adjust the base categories that map to your digital outfits. Tap a token to toggle status.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {['Eastern', 'Western', 'Casual', 'Formal'].map((style) => {
                const isSelected = selectedStyles.includes(style);

                return (
                  <button
                    key={style}
                    onClick={() => toggleStyle(style)}
                    className={`px-5 py-4 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-150'
                        : 'bg-white border-brand-border/60 text-slate-700 hover:border-sage-green'
                    }`}
                  >
                    <span>{style}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </button>
                );
              })}
            </div>

            <p className="text-[10px] text-slate-400 font-bold font-mono leading-tight">
              Selected: {selectedStyles.join(', ')} / Weighting balanced by physical size.
            </p>
          </section>

          <section className="lg:col-span-5 bg-white p-8 rounded-2xl border border-brand-border/60 shadow-sm border-l-4 border-blue-600 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute right-[-10px] top-[-10px] opacity-[0.05] pointer-events-none">
              <Sparkles className="w-56 h-56 text-sage-green" />
            </div>

            <div className="z-10 relative">
              <span className="text-[10px] uppercase font-bold tracking-widest text-sage-green">
                Personalized Stylist Recommendation
              </span>

              <blockquote className="text-xl sm:text-2xl font-display text-brand-dark italic leading-relaxed mt-6 mb-8 font-light">
                &ldquo;Configuring your active{' '}
                <span className="font-semibold text-sage-green not-italic">
                  {activeStylesText}
                </span>{' '}
                parameters generates high cohesive depth. Muted tailoring will emphasize optical shoulder volume.&rdquo;
              </blockquote>
            </div>

            <div className="z-10 relative flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />

              <span className="text-[10px] tracking-wider uppercase font-extrabold text-slate-400 font-sans">
                Atelier Engine version v4.11
              </span>
            </div>
          </section>

          <section className="lg:col-span-12 bg-white p-8 rounded-2xl border border-brand-border/60 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
              <div>
                <h3 className="text-lg font-display font-semibold text-brand-dark">
                  Custom Fit Calibration
                </h3>

                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Set physical stature coordinates to verify silhouette drapery and prevent size mismatches.
                </p>
              </div>

              <div className="text-xs text-sage-green font-bold font-sans">
                Metric calculations calibrated
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <MeasureInput
                label="Height (cm)"
                value={height}
                onChange={setHeight}
              />

              <MeasureInput
                label="Chest Circumference (cm)"
                value={chest}
                onChange={setChest}
              />

              <MeasureInput
                label="Waist Circumference (cm)"
                value={waist}
                onChange={setWaist}
              />
            </div>
          </section>

          <section className="lg:col-span-12 bg-white p-8 rounded-2xl border border-brand-border/60 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
              <div>
                <h3 className="text-lg font-display font-semibold text-brand-dark">
                  Color Harmony Calibration
                </h3>

                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Coordinating shades tailored specifically to your biometric facial scan contrast levels ({user.contrastType || 'Medium Contrast'}).
                </p>
              </div>

              <button
                onClick={regeneratePalette}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 bg-cream-card/60 hover:bg-slate-200 rounded-xl transition-all focus:outline-none border border-transparent cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-600 animate-[spin_4s_linear]" />
                Regenerate Palette
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {currentPalette.map((swatch, idx) => (
                <div
                  key={swatch.name}
                  onClick={() => toggleSwatchChecked(idx)}
                  className="group cursor-pointer flex flex-col items-center select-none"
                >
                  <div
                    style={{ backgroundColor: swatch.hex }}
                    className="h-32 w-full rounded-xl border border-slate-100 group-hover:border-slate-800 transition-all shadow-inner relative overflow-hidden"
                  >
                    {swatch.checked && (
                      <div className="absolute top-2 right-2 bg-white/95 text-brand-dark rounded-full p-0.5 shadow-sm">
                        <CheckCircle2 className="w-4 h-4 text-sage-green font-bold" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-[0.03] transition-all" />
                  </div>

                  <span
                    className={`text-xs mt-3 ${
                      swatch.checked
                        ? 'font-bold text-brand-dark'
                        : 'text-slate-500'
                    }`}
                  >
                    {swatch.name}
                  </span>

                  <span className="text-[10px] text-slate-400 font-mono uppercase mt-0.5 font-bold">
                    {swatch.hex}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-neutral-400 font-mono mt-8">
              *Tapping swatches selects active matching weights. Deep shades emphasize optical contour structure.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-brand-border/60 hover:border-brand-border/60 hover:shadow-lg transition-all rounded-2xl p-5 text-left flex items-center gap-4"
    >
      <div className="w-12 h-12 rounded-2xl bg-sage-green/10 text-sage-green flex items-center justify-center flex-shrink-0">
        {icon}
      </div>

      <div>
        <h3 className="text-sm font-black text-brand-dark">
          {title}
        </h3>

        <p className="text-xs text-slate-500 font-semibold mt-1">
          {description}
        </p>
      </div>
    </button>
  );
}

function MeasureInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="border border-brand-border/60 focus-within:border-blue-600 rounded-xl p-3 bg-white transition-all">
      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">
        {label}
      </label>

      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full border-none p-0 text-lg font-bold text-brand-dark focus:outline-none focus:ring-0 bg-transparent"
        />

        <span className="text-xs text-slate-400 font-sans font-bold">
          cm
        </span>
      </div>
    </div>
  );
}