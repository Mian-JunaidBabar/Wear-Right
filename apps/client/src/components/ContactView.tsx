import React, { useState } from "react";
import {
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { ADMIN_WHATSAPP_NUMBER } from "../config/api";

export default function ContactView() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const adminWhatsAppNumber = "923021191771";
  const adminWhatsAppNumber = ADMIN_WHATSAPP_NUMBER;

  const openWhatsApp = () => {
    const message = `Hello Admin, I need help regarding Wear Right.`;

    window.open(
      `https://wa.me/${adminWhatsAppNumber}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
  };

  const submitContact = (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim() || !form.phone.trim() || !form.message.trim()) {
      alert("Please enter your name, phone and message.");
      return;
    }

    const message = `Wear Right Contact Request

Name: ${form.name}
Email: ${form.email || "Not provided"}
Phone: ${form.phone}

Message:
${form.message}`;

    window.open(
      `https://wa.me/${adminWhatsAppNumber}?text=${encodeURIComponent(message)}`,
      "_blank",
    );

    setForm({
      name: "",
      email: "",
      phone: "",
      message: "",
    });
  };

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-cream-base px-6 py-16 text-left font-sans">
      {/* Background ambient light gradients */}
      <div className="absolute right-0 top-20 w-96 h-96 bg-blue-100/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute left-0 bottom-20 w-96 h-96 bg-blue-50/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header Section */}
        <div className="mb-14 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 w-max mb-6 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-brand-gold animate-pulse" />
            <span className="text-[10px] uppercase tracking-widest text-blue-700 font-extrabold font-sans">
              Contact Support
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-serif font-bold text-brand-dark tracking-tight leading-tight">
            Get Help from Wear Right
          </h1>
          <div className="w-12 h-1 bg-brand-gold mt-4 rounded-full" />

          <p className="text-sm text-slate-500 font-sans leading-relaxed mt-6 font-medium max-w-2xl">
            Need help with face scan, product recommendation, order status or
            outfit selection? Contact Wear Right support.
          </p>
        </div>

        {/* Content Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-[42%_58%] gap-8">
          {/* Support Info Cards (Left Column) */}
          <div className="space-y-6">
            <ContactCard
              icon={<Phone className="w-5 h-5 text-brand-gold" />}
              title="Phone / WhatsApp"
              value="+92 302 1191771"
            />

            <ContactCard
              icon={<Mail className="w-5 h-5 text-brand-gold" />}
              title="Email"
              value="hammadahmadch17@gmail.com"
            />

            <ContactCard
              icon={<MapPin className="w-5 h-5 text-brand-gold" />}
              title="Location"
              value="Lahore, Pakistan"
            />

            {/* Quick WhatsApp Support Forest Green Card */}
            <div className="bg-blue-600 text-white rounded-[2rem] p-8 shadow-lg relative overflow-hidden border border-blue-700/50">
              {/* Decorative glows */}
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-6 shadow-md relative z-10">
                <img
                  src="/brand/wr-icon.png"
                  alt="Wear Right"
                  className="w-14 h-14 object-contain"
                  onError={(event) => {
                    event.currentTarget.src = "/brand/wr-monogram.png";
                  }}
                />
              </div>

              <h2 className="text-2xl font-serif font-normal relative z-10">
                Quick WhatsApp Support
              </h2>

              <p className="text-xs text-blue-50 font-sans mt-3 leading-relaxed relative z-10">
                For fastest help, send a direct WhatsApp message to the admin.
              </p>

              <button
                onClick={openWhatsApp}
                className="mt-6 bg-white hover:bg-slate-50 text-blue-900 px-6 py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border-none cursor-pointer shadow-md hover:scale-[1.02] active:scale-95 transition-all duration-300 relative z-10"
              >
                <MessageCircle className="w-4 h-4 text-blue-700" />
                Open WhatsApp
              </button>
            </div>
          </div>

          {/* Form Card (Right Column) */}
          <div className="bg-white border border-blue-200/60 rounded-[2rem] p-6 lg:p-8 shadow-sm">
            <h2 className="text-2xl font-serif font-bold text-brand-dark">
              Send Message
            </h2>

            <p className="text-xs text-slate-400 font-sans mt-2">
              Fill the form and your message will open directly in WhatsApp.
            </p>

            <form onSubmit={submitContact} className="mt-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <InputField
                  label="Full Name"
                  value={form.name}
                  onChange={(value) => setForm({ ...form, name: value })}
                  placeholder="Your name"
                  icon={<User className="w-4 h-4" />}
                />

                <InputField
                  label="Phone Number"
                  value={form.phone}
                  onChange={(value) => setForm({ ...form, phone: value })}
                  placeholder="03000000000"
                  icon={<Phone className="w-4 h-4" />}
                />
              </div>

              <InputField
                label="Email (Optional)"
                type="email"
                value={form.email}
                onChange={(value) => setForm({ ...form, email: value })}
                placeholder="customer@gmail.com"
                icon={<Mail className="w-4 h-4" />}
              />

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2 font-sans">
                  Message
                </label>

                <textarea
                  value={form.message}
                  onChange={(event) =>
                    setForm({ ...form, message: event.target.value })
                  }
                  rows={6}
                  placeholder="Write your message..."
                  className="w-full bg-cream-base border border-blue-200/60 rounded-xl px-4 py-3 text-sm font-sans font-medium outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold resize-none transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-brand-gold hover:opacity-95 text-white py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-brand-gold/10 hover:scale-[1.01] active:scale-99 transition-all duration-300 border-none cursor-pointer"
              >
                <Send className="w-4 h-4 text-white" />
                Send Message on WhatsApp
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="bg-white border border-blue-200/60 rounded-3xl p-6 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold font-sans">
          {title}
        </p>

        <p className="text-sm font-sans font-bold text-brand-dark mt-1">
          {value}
        </p>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: React.ReactNode;
  type?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2 font-sans">
        {label}
      </label>

      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </div>

        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-cream-base border border-blue-200/60 rounded-xl py-3.5 pl-11 pr-4 text-sm font-sans font-medium outline-none focus:ring-2 focus:ring-brand-gold/20 focus:border-brand-gold transition-all"
        />
      </div>
    </div>
  );
}
