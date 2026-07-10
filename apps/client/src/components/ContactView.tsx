import React, { useState } from 'react';
import {
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  User,
} from 'lucide-react';

export default function ContactView() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });

  const adminWhatsAppNumber = '923021191771';

  const openWhatsApp = () => {
    const message = `Hello Admin, I need help regarding Wear Right.`;

    window.open(
      `https://wa.me/${adminWhatsAppNumber}?text=${encodeURIComponent(message)}`,
      '_blank'
    );
  };

  const submitContact = (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim() || !form.phone.trim() || !form.message.trim()) {
      alert('Please enter your name, phone and message.');
      return;
    }

    const message = `Wear Right Contact Request

Name: ${form.name}
Email: ${form.email || 'Not provided'}
Phone: ${form.phone}

Message:
${form.message}`;

    window.open(
      `https://wa.me/${adminWhatsAppNumber}?text=${encodeURIComponent(message)}`,
      '_blank'
    );

    setForm({
      name: '',
      email: '',
      phone: '',
      message: '',
    });
  };

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-cream-base px-6 py-12 text-left font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 max-w-3xl">
          <p className="text-[10px] uppercase tracking-widest text-sage-green font-black mb-2">
            Contact Support
          </p>

          <h1 className="text-4xl sm:text-6xl font-black text-brand-dark tracking-tight">
            Get Help from Wear Right
          </h1>

          <p className="text-sm text-slate-500 font-semibold leading-relaxed mt-4">
            Need help with face scan, product recommendation, order status or outfit selection? Contact Wear Right support.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[42%_58%] gap-8">
          <div className="space-y-5">
            <ContactCard
              icon={<Phone className="w-5 h-5" />}
              title="Phone / WhatsApp"
              value="+92 302 1191771"
            />

            <ContactCard
              icon={<Mail className="w-5 h-5" />}
              title="Email"
              value="hammadahmadch17@gmail.com"
            />

            <ContactCard
              icon={<MapPin className="w-5 h-5" />}
              title="Location"
              value="Lahore, Pakistan"
            />

            <div className="bg-slate-950 text-white rounded-3xl p-8 shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-5">
                <img
                  src="/brand/wr-icon.png"
                  alt="Wear Right"
                  className="w-14 h-14 object-contain"
                  onError={(event) => {
                    event.currentTarget.src = '/brand/wr-monogram.png';
                  }}
                />
              </div>

              <h2 className="text-2xl font-black">
                Quick WhatsApp Support
              </h2>

              <p className="text-sm text-slate-300 font-semibold mt-3">
                For fastest help, send a direct WhatsApp message to the admin.
              </p>

              <button
                onClick={openWhatsApp}
                className="mt-6 bg-green-500 hover:bg-green-600 text-white px-5 py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Open WhatsApp
              </button>
            </div>
          </div>

          <div className="bg-white border border-brand-border/60 rounded-3xl p-6 lg:p-8 shadow-sm">
            <h2 className="text-3xl font-black text-brand-dark">
              Send Message
            </h2>

            <p className="text-sm text-slate-500 font-semibold mt-2">
              Fill the form and your message will open directly in WhatsApp.
            </p>

            <form onSubmit={submitContact} className="mt-8 space-y-5">
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
                label="Email Optional"
                type="email"
                value={form.email}
                onChange={(value) => setForm({ ...form, email: value })}
                placeholder="customer@gmail.com"
                icon={<Mail className="w-4 h-4" />}
              />

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                  Message
                </label>

                <textarea
                  value={form.message}
                  onChange={(event) =>
                    setForm({ ...form, message: event.target.value })
                  }
                  rows={6}
                  placeholder="Write your message..."
                  className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-brand-gold hover:opacity-90 text-white py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-brand-gold/10"
              >
                <Send className="w-4 h-4" />
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
    <div className="bg-white border border-brand-border/60 rounded-3xl p-6 shadow-sm flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-sage-green/10 text-sage-green flex items-center justify-center flex-shrink-0">
        {icon}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
          {title}
        </p>

        <p className="text-sm font-black text-brand-dark mt-1">
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
  type = 'text',
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
      <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
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
          className="w-full bg-cream-base border border-brand-border/60 rounded-xl py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
        />
      </div>
    </div>
  );
}