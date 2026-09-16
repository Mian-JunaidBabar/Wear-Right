import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Sparkles,
  ClipboardList,
  Heart,
  LogOut,
} from "lucide-react";
import { UserState } from "../types";
import { API_ENDPOINTS } from "../config/api";

interface ProfileViewProps {
  user: UserState;
  setUser: React.Dispatch<React.SetStateAction<UserState>>;
}

export default function ProfileView({ user, setUser }: ProfileViewProps) {
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [culturalPref, setCulturalPref] = useState("Western");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setUser((prev) => ({
      ...prev,
      name,
      email,
    }));
    setIsEditing(false);
    alert("Changes saved successfully!");
  };

  const updateCulturalPreference = async (pref: string) => {
    setCulturalPref(pref);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/profiles/", {
      const response = await fetch(API_ENDPOINTS.profiles, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user: 1,
          cultural_preference: pref,
        }),
      });
      if (!response.ok) {
        console.warn("Backend profile update failed or pending.");
      }
    } catch (err) {
      console.error("Error saving cultural preference:", err);
    }
  };

  const handleLogout = () => {
    setUser({
      name: "",
      email: "",
      avatar: "",
      role: "",
      isLoggedIn: false,
    });
    navigate("/");
    alert("Logged out successfully.");
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
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isEditing}
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
            </div>

            {isEditing && (
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setName(user.name);
                    setEmail(user.email);
                  }}
                  className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
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
                  You haven't scanned your face yet.
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
