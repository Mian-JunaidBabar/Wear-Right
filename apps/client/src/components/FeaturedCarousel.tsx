import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, Sparkles, MoveRight } from "lucide-react";

interface CarouselItem {
  id: string;
  name: string;
  price: number;
  image: string;
  match: number;
  style: string;
  description: string;
}

const CAROUSEL_ITEMS: CarouselItem[] = [
  {
    id: "prod-007",
    name: "Modernist High-Collar Cape",
    price: 1200,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAcOQSUo77ogSWtY3BnUHEGCTJjjWWpeVC-BjB07LgnIely8THEwE7_ykS4uPMoVlTyCqwgrFce6Y9bY5FSui9tcq1gaNPXHl8N7p5UMBmm26xbPMqSoodiZ9dS6aTXkSggLuscXFoj-SXHwfy3bttjkcFds0JgjkmidqGZ6Z0KOSQM3f_QmejuzGrcISbWIctfU3EdCtl9wnY0AO-BbmWTqDzCivYjN0eo0mtlkLYwj62gvRUuwiirYqYqN2-O8XhBFm1UgU8XPWQ",
    match: 99,
    style: "Avant-Garde",
    description:
      "A structural, sculptural high-fashion masterpiece crafted from bonded wool with deep dimensional outlines.",
  },
  {
    id: "prod-001",
    name: "Heritage Suede Trucker",
    price: 850,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBwRNpuuqMb7L_ImCpH_S_PKJmdb_OZcbhX2psDFwbFbb-sn_BV6FAhUv9mwJNTebmx7yUofWFd_c8pmI_shC2wIbQ3QCKIu8hyQy1sk2eD9sAnG55t7r1mB5_tDCNPQEf_FOWgoYSXygLWmok_LUIjZQ3m8m6Ebht0M6WeCs3FpCZ04qHakJwyxKWSw3CL5P0mxtk5Jw3z1lQpCExHr2-aKMMRriH8ao6uiQGUwqtfgLB2ZFnR1CIG-zXNUysW4XT-PLTslt_3Q2Q",
    match: 98,
    style: "Western",
    description:
      "Calibrated saddle-tinted suede with custom tailored seams. High structural recovery and timeless silhouette.",
  },
  {
    id: "wr-001",
    name: "Obsidian Silk Evening Gown",
    price: 1950,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA9ODxf2GHcJDWnpGpL3Qi5POG7fL1rLEU7MMLEt6hp8ZWrKUCPaXMheOe362WccVBCiwUrkvxygL2NEdlSmEmD0JE933ilq96YIqAKN50yFD2VKbloC_nPpzbNI7e2fBau2CLCCNpm0MmAkWvghKsvcRVKPFIkghx_SBLZgGruRZ1u5kIo3T0c-9zLJSyIEK62L-ALcjIXXSrtjt2s0S5_2s3L11smXecLZfAzn0IXebWP01FaeG5TfisjwhmzrE9sUaipW1IzFNY",
    match: 97,
    style: "Formal",
    description:
      "Surgical bias-cut luxury silk. Flowing contours matching dark cold undertone palettes with obsidian clarity.",
  },
  {
    id: "prod-008",
    name: "Asymmetric Tailored Blazer",
    price: 950,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCS_KoB3eqo7HK6hmzDtLJrEiET8m5ZE3Mgi-BslQqHHkf_Q7cVAvqX-LJl9_n6ovvhqBk2nqAW6yLp6EiQ2r9xNdL9ik5LJGhncA9nLTlLikEKCYIIMaqeX6XK0UJQFrQGfbITB3AT2ApZiQpGClW3lZK0X0bBMnXbZuQGAidPHmZbl1bZ1qr8UT52tWrWvHBRGOHvAOGcAlv__HPLSw86UFKfiKPVH3bnh6bDuaoMFiyGHEcWWekBZDLF92tmkZzt7aQbORhB1uw",
    match: 92,
    style: "Formal",
    description:
      "Deconstructed tailored line pairing perfectly with monochrome styles and contrast layering.",
  },
];

export default function FeaturedCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right
  const [dragStart, setDragStart] = useState(0);
  const autoplayTimer = useRef<NodeJS.Timeout | null>(null);

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: "spring" as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.4 },
      },
    },
    exit: (dir: number) => ({
      x: dir < 0 ? "100%" : "-100%",
      opacity: 0,
      transition: {
        x: { type: "spring" as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.4 },
      },
    }),
  };

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % CAROUSEL_ITEMS.length);
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex(
      (prev) => (prev - 1 + CAROUSEL_ITEMS.length) % CAROUSEL_ITEMS.length,
    );
  };

  const startAutoplay = () => {
    stopAutoplay();
    autoplayTimer.current = setInterval(() => {
      handleNext();
    }, 6000);
  };

  const stopAutoplay = () => {
    if (autoplayTimer.current) {
      clearInterval(autoplayTimer.current);
    }
  };

  useEffect(() => {
    startAutoplay();
    return () => stopAutoplay();
  }, []);

  // Gesture handling for touch and click slides
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    stopAutoplay();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    setDragStart(clientX);
  };

  const handleDragEnd = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX =
      "changedTouches" in e ? e.changedTouches[0].clientX : e.clientX;
    const diff = dragStart - clientX;
    const threshold = 50; // min swipe distance in px

    if (diff > threshold) {
      handleNext();
    } else if (diff < -threshold) {
      handlePrev();
    }
    startAutoplay();
  };

  const activeItem = CAROUSEL_ITEMS[currentIndex];

  return (
    <section
      id="lookbook-carousel"
      className="max-w-7xl mx-auto px-6 py-6 w-full select-none"
      onMouseEnter={stopAutoplay}
      onMouseLeave={startAutoplay}
    >
      <div className="mb-8 text-left">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold font-sans">
            Interactive Lookbook
          </span>
        </div>
        <h2 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
          Featured Atelier Masterpieces
        </h2>
      </div>

      {/* Main container frame */}
      <div
        className="w-full relative h-[420px] sm:h-[480px] lg:h-[520px] bg-slate-100 rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col md:flex-row cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
        onMouseUp={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
      >
        {/* Animated Slide Frame */}
        <div className="relative w-full md:w-1/2 h-1/2 md:h-full overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 w-full h-full"
            >
              <img
                src={activeItem.image}
                alt={activeItem.name}
                className="w-full h-full object-cover pointer-events-none"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent pointer-events-none md:hidden" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Caption Panel Frame */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full bg-white p-6 sm:p-10 lg:p-12 flex flex-col justify-between text-left relative">
          <div className="relative overflow-hidden h-full flex flex-col justify-center">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: direction > 0 ? 15 : -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction > 0 ? -15 : 15 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3.5">
                  <span className="px-2.5 py-1 text-[10px] uppercase font-extrabold tracking-widest text-blue-600 bg-blue-50 border border-blue-100 rounded-md">
                    {activeItem.style}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-600">
                    <Sparkles className="w-3 h-3 text-emerald-500" />
                    {activeItem.match}% MATCH
                  </div>
                </div>

                <h3 className="text-xl sm:text-2xl lg:text-3xl font-display font-extrabold text-slate-900 tracking-tight leading-tight">
                  {activeItem.name}
                </h3>

                <p className="text-slate-500 font-sans text-xs sm:text-sm leading-relaxed font-semibold max-w-md">
                  {activeItem.description}
                </p>

                <p className="text-lg font-mono font-bold text-slate-900">
                  ${activeItem.price.toLocaleString()}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Controls inside description space or anchored */}
          <div className="flex items-center justify-between mt-4 md:mt-0 pt-4 border-t border-slate-100">
            {/* Dots */}
            <div className="flex gap-2">
              {CAROUSEL_ITEMS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDirection(idx > currentIndex ? 1 : -1);
                    setCurrentIndex(idx);
                  }}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-350 cursor-pointer ${
                    currentIndex === idx
                      ? "bg-blue-600 w-6 shadow-sm shadow-blue-100"
                      : "bg-slate-200 hover:bg-slate-300"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            {/* Arrows */}
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrev();
                }}
                className="w-10 h-10 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="w-10 h-10 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors flex items-center justify-center cursor-pointer shadow-sm active:scale-95"
                aria-label="Next slide"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
