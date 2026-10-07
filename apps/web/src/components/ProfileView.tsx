"use client";

import React, { useState } from "react";
import { useNavigate } from "@/lib/navigation";
import {
  ArrowRight,
  ClipboardList,
  Heart,
  LogOut,
} from "lucide-react";
import { notify } from "@/lib/notify";
import { useAuth } from "@/features/auth/AuthProvider";
import type { ApiProfile } from "@/features/auth/api";

const GENDERS: ApiProfile["gender"][] = ["male", "female", "unspecified"];
const STYLES: ApiProfile["preferred_style"][] = ["casual", "formal", "eastern", "mixed"];

const FIELD_CLASS =
  "w-full bg-cream-base border border-blue-200/60 rounded-xl py-3 px-4 text-sm font-sans font-medium outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold transition-all disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-50";
const LABEL_CLASS = "text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2 font-sans";

export default function ProfileView() {
  const navigate = useNavigate();
  const { user, profile, updateProfile, logout } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const email = user.email;
  // Phone and address are not stored on the account yet; they stay on this page only.
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState<ApiProfile["gender"]>(profile?.gender ?? "unspecified");
  const [preferredStyle, setPreferredStyle] = useState<ApiProfile["preferred_style"]>(profile?.preferred_style ?? "mixed");
  const [topSize, setTopSize] = useState(profile?.top_size ?? "");
  const [bottomSize, setBottomSize] = useState(profile?.bottom_size ?? "");
  const [shoeSize, setShoeSize] = useState(profile?.shoe_size ?? "");
  const [culturalPref, setCulturalPref] = useState(profile?.cultural_preference ?? "Western");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateProfile({
        name,
        gender,
        preferred_style: preferredStyle,
        top_size: topSize,
        bottom_size: bottomSize,
        shoe_size: shoeSize,
      });
      setIsEditing(false);
      notify("Changes saved successfully!");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Changes could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const updateCulturalPreference = async (pref: string) => {
    setCulturalPref(pref);
    try {
      await updateProfile({ cultural_preference: pref });
    } catch (err) {
      console.error("Error saving cultural preference:", err);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
    notify("Logged out successfully.");
  };

  return (
    <div className="w-full bg-cream-base pb-24 text-left font-sans">
      {/* Background ambient light gradients */}
      <div className="absolute right-0 top-20 w-96 h-96 bg-blue-100/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute left-0 bottom-20 w-96 h-96 bg-blue-50/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {/* Profile Header Card */}
        <div className="bg-white border border-blue-200/60 rounded-[2rem] p-6 sm:p-8 shadow-sm mb-8 flex flex-col sm:flex-row items-center sm:justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {/* Avatar Column */}
            <div className="w-20 h-20 rounded-full bg-blue-600 text-white border-4 border-blue-50 flex items-center justify-center font-serif font-bold text-2xl shadow-md shadow-blue-900/10 shrink-0">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : name ? (
                name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              ) : (
                "U"
              )}
            </div>
            {/* User Info Column */}
            <div>
              <h1 className="text-3xl sm:text-4xl font-serif font-bold text-brand-dark tracking-tight leading-tight">
                {name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 font-sans mt-1 font-medium">
                {email}
              </p>
            </div>
          </div>

          {/* Edit Profile Button */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-3.5 text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 rounded-xl cursor-pointer shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 border-none"
          >
            {isEditing ? "Cancel Edit" : "Edit Profile"}
          </button>
        </div>

        {/* Personal Details Section */}
        <div className="bg-white border border-blue-200/60 rounded-[2rem] p-6 sm:p-8 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-serif font-bold text-brand-dark">
              Personal Details
            </h2>
            {isEditing && (
              <span className="text-[10px] uppercase font-bold tracking-widest text-brand-gold animate-pulse">
                Editing Mode Active
              </span>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2 font-sans">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isEditing}
                  placeholder="Your Name"
                  className="w-full bg-cream-base border border-blue-200/60 rounded-xl py-3 px-4 text-sm font-sans font-medium outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold transition-all disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2 font-sans">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  disabled
                  title="Your email is your sign-in name and cannot be changed here."
                  placeholder="email@example.com"
                  className="w-full bg-cream-base border border-blue-200/60 rounded-xl py-3 px-4 text-sm font-sans font-medium outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold transition-all disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2 font-sans">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!isEditing}
                  placeholder="e.g. +92 300 1234567"
                  className="w-full bg-cream-base border border-blue-200/60 rounded-xl py-3 px-4 text-sm font-sans font-medium outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold transition-all disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2 font-sans">
                  Delivery Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={!isEditing}
                  placeholder="Your shipping address"
                  className="w-full bg-cream-base border border-blue-200/60 rounded-xl py-3 px-4 text-sm font-sans font-medium outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold transition-all disabled:opacity-75 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as ApiProfile["gender"])}
                  disabled={!isEditing}
                  className={FIELD_CLASS}
                >
                  {GENDERS.map((value) => (
                    <option key={value} value={value}>
                      {value.charAt(0).toUpperCase() + value.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={LABEL_CLASS}>Preferred Style</label>
                <select
                  value={preferredStyle}
                  onChange={(e) => setPreferredStyle(e.target.value as ApiProfile["preferred_style"])}
                  disabled={!isEditing}
                  className={FIELD_CLASS}
                >
                  {STYLES.map((value) => (
                    <option key={value} value={value}>
                      {value.charAt(0).toUpperCase() + value.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={LABEL_CLASS}>Top Size</label>
                <input
                  type="text"
                  value={topSize}
                  onChange={(e) => setTopSize(e.target.value)}
                  disabled={!isEditing}
                  maxLength={10}
                  placeholder="e.g. M"
                  className={FIELD_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Bottom Size</label>
                <input
                  type="text"
                  value={bottomSize}
                  onChange={(e) => setBottomSize(e.target.value)}
                  disabled={!isEditing}
                  maxLength={10}
                  placeholder="e.g. 32"
                  className={FIELD_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Shoe Size</label>
                <input
                  type="text"
                  value={shoeSize}
                  onChange={(e) => setShoeSize(e.target.value)}
                  disabled={!isEditing}
                  maxLength={10}
                  placeholder="e.g. 42"
                  className={FIELD_CLASS}
                />
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setName(user.name);
                    setGender(profile?.gender ?? "unspecified");
                    setPreferredStyle(profile?.preferred_style ?? "mixed");
                    setTopSize(profile?.top_size ?? "");
                    setBottomSize(profile?.bottom_size ?? "");
                    setShoeSize(profile?.shoe_size ?? "");
                  }}
                  className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 text-xs font-black uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all border-none cursor-pointer shadow-md hover:scale-[1.01] active:scale-99"
                >
                  Save Changes
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Style Preferences Section */}
        <div className="bg-white border border-blue-200/60 rounded-[2rem] p-6 sm:p-8 shadow-sm mb-8">
          <h2 className="text-xl font-serif font-bold text-brand-dark">
            Your Style Preference
          </h2>
          <p className="text-xs text-slate-500 font-sans mt-1">
            This helps us show you more relevant recommendations
          </p>

          <div className="flex flex-wrap gap-3 mt-6">
            {["Eastern", "Western", "Casual", "Formal"].map((pref) => {
              const isSelected = culturalPref === pref;

              return (
                <button
                  key={pref}
                  onClick={() => updateCulturalPreference(pref)}
                  className={`px-6 py-3 rounded-full border text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-150"
                      : "bg-white border-brand-border/60 text-slate-700 hover:border-brand-gold"
                  }`}
                >
                  {pref}
                </button>
              );
            })}
          </div>
        </div>

        {/* Your Skin Tone Profile Section */}
        <div className="bg-white border border-blue-200/60 rounded-[2rem] p-6 sm:p-8 shadow-sm mb-8">
          <h2 className="text-xl font-serif font-bold text-brand-dark">
            Your Skin Tone Profile
          </h2>

          {user.contrastType ? (
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl border border-blue-150 flex flex-col items-center justify-center shadow-inner relative overflow-hidden bg-blue-50/50 shrink-0">
                  <div
                    className={`w-10 h-10 rounded-full border border-white/20 ${
                      user.contrastType.toLowerCase().includes("fair")
                        ? "bg-[#E5C298]"
                        : user.contrastType.toLowerCase().includes("dark")
                          ? "bg-[#5C3818]"
                          : "bg-[#A87C59]"
                    }`}
                  />
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-brand-gold">
                    Detected Skin Tone
                  </span>
                  <h3 className="text-lg font-serif font-semibold text-brand-dark mt-0.5">
                    {user.contrastType}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => navigate("/facescan")}
                className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-3 text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 rounded-xl cursor-pointer border-none shadow-md hover:scale-[1.02] active:scale-95"
              >
                Re-Scan Face
              </button>
            </div>
          ) : (
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div>
                <p className="text-sm text-slate-500 font-medium font-sans">
                  You haven&apos;t scanned your face yet.
                </p>
                <p className="text-xs text-slate-400 font-sans mt-1 font-medium">
                  Scan your skin tone to unlock personalized outfit color
                  matchmaking.
                </p>
              </div>

              <button
                onClick={() => navigate("/facescan")}
                className="bg-blue-600 text-white hover:bg-blue-700 px-6 py-3.5 text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 rounded-xl cursor-pointer border-none shadow-md hover:scale-[1.02] active:scale-95"
              >
                Scan Now
              </button>
            </div>
          )}
        </div>

        {/* Quick Links Section */}
        <div className="bg-white border border-blue-200/60 rounded-[2rem] p-6 sm:p-8 shadow-sm mt-8">
          <h2 className="text-xl font-serif font-bold text-brand-dark mb-6">
            Quick Links
          </h2>

          <div className="space-y-3">
            {/* My Orders link */}
            <button
              onClick={() => navigate("/my-orders")}
              className="w-full bg-cream-base/30 hover:bg-blue-50/40 border border-brand-border/60 hover:border-blue-150 hover:shadow-sm transition-all rounded-2xl p-4 text-left flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ClipboardList className="w-5 h-5 text-brand-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-brand-dark">
                    My Orders
                  </h3>
                  <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                    Track your order statuses and invoices
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-350 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Wishlist link */}
            <button
              onClick={() => navigate("/wishlist")}
              className="w-full bg-cream-base/30 hover:bg-blue-50/40 border border-brand-border/60 hover:border-blue-150 hover:shadow-sm transition-all rounded-2xl p-4 text-left flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Heart className="w-5 h-5 text-brand-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-brand-dark">
                    Wishlist
                  </h3>
                  <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                    View your saved items
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-350 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Logout link */}
            <button
              onClick={handleLogout}
              className="w-full bg-red-50/10 hover:bg-red-50 border border-red-100 hover:border-red-200 hover:shadow-sm transition-all rounded-2xl p-4 text-left flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-650 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <LogOut className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-red-600">Logout</h3>
                  <p className="text-[10px] text-red-400 font-sans mt-0.5">
                    End your active styling session
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-red-300 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
