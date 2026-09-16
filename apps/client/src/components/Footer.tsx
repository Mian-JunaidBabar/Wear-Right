import React from "react";
import { useNavigate } from "react-router-dom";

export default function Footer() {
  const navigate = useNavigate();

  return (
    <footer className="w-full bg-[#152018] text-slate-200 mt-20 border-t border-emerald-950/45 text-left font-sans">
      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
        {/* Column 1: Quick Links */}
        <div>
          <h4 className="font-serif text-lg font-normal text-brand-gold mb-6">
            Quick Links
          </h4>
          <ul className="space-y-3 text-xs text-slate-400 font-medium">
            <li>
              <button
                onClick={() => navigate("/")}
                className="hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 text-left"
              >
                Home
              </button>
            </li>
            <li>
              <button
                onClick={() => navigate("/shop")}
                className="hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 text-left"
              >
                Shop
              </button>
            </li>
            <li>
              <button
                onClick={() => navigate("/about")}
                className="hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 text-left"
              >
                About Us
              </button>
            </li>
            <li>
              <button
                onClick={() => navigate("/contact")}
                className="hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 text-left"
              >
                Contact
              </button>
            </li>
          </ul>
        </div>

        {/* Column 2: Categories */}
        <div>
          <h4 className="font-serif text-lg font-normal text-brand-gold mb-6">
            Categories
          </h4>
          <ul className="space-y-3 text-xs text-slate-400 font-medium">
            <li>
              <button
                onClick={() => navigate("/shop?gender=Men")}
                className="hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 text-left"
              >
                Men Collection
              </button>
            </li>
            <li>
              <button
                onClick={() => navigate("/shop?gender=Women")}
                className="hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 text-left"
              >
                Women Collection
              </button>
            </li>
          </ul>
        </div>

        {/* Column 3: Contact Info */}
        <div>
          <h4 className="font-serif text-lg font-normal text-brand-gold mb-6">
            Contact Info
          </h4>
          <p className="text-xs text-slate-400 font-medium mb-3">
            WhatsApp:{" "}
            <a
              href="https://wa.me/923001234567"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 hover:underline"
            >
              +92 300 1234567
            </a>
          </p>
          <p className="text-xs text-slate-400 font-medium mb-3">
            Phone: +92 300 1234567
          </p>
          <p className="text-xs text-slate-400 font-medium">
            Email: support@wearright.com
          </p>
        </div>

        {/* Column 4: Social Media */}
        <div>
          <h4 className="font-serif text-lg font-normal text-brand-gold mb-6">
            Follow Us
          </h4>
          <div className="flex gap-4">
            <a
              href="#"
              className="w-10 h-10 rounded-xl bg-emerald-950/40 border border-emerald-800/20 flex items-center justify-center text-slate-400 hover:text-white hover:bg-emerald-900/60 transition-colors"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
              </svg>
            </a>
            <a
              href="#"
              className="w-10 h-10 rounded-xl bg-emerald-950/40 border border-emerald-800/20 flex items-center justify-center text-slate-400 hover:text-white hover:bg-emerald-900/60 transition-colors"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
            <a
              href="#"
              className="w-10 h-10 rounded-xl bg-emerald-950/40 border border-emerald-800/20 flex items-center justify-center text-slate-400 hover:text-white hover:bg-emerald-900/60 transition-colors"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Copyright Bottom Bar */}
      <div className="w-full border-t border-emerald-900/40 py-6 text-center text-[10px] uppercase font-bold tracking-widest text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>&copy; 2026 Wear Right. All rights reserved.</span>
          <span className="text-[9px] text-slate-600">
            Designed with AI Calibration
          </span>
        </div>
      </div>
    </footer>
  );
}
