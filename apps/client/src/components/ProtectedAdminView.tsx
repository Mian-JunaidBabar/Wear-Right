import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, LogOut, Eye, EyeOff } from 'lucide-react';
import AdminView from './AdminView';

const ADMIN_PASSWORD = 'admin123';

export default function ProtectedAdminView() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const savedLogin = localStorage.getItem('wearRightAdminLoggedIn');

    if (savedLogin === 'true') {
      setIsAdminLoggedIn(true);
    }
  }, []);

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();

    if (!password.trim()) {
      alert('Please enter admin password.');
      return;
    }

    if (password !== ADMIN_PASSWORD) {
      alert('Invalid admin password.');
      return;
    }

    localStorage.setItem('wearRightAdminLoggedIn', 'true');
    setIsAdminLoggedIn(true);
    setPassword('');
  };

  const handleLogout = () => {
    localStorage.removeItem('wearRightAdminLoggedIn');
    setIsAdminLoggedIn(false);
  };

  if (isAdminLoggedIn) {
    return (
      <AdminView onLogout={handleLogout} />
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-cream-base px-6 py-16 flex items-center justify-center text-left font-sans">
      <div className="max-w-md w-full bg-white border border-brand-border/60 rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-slate-950 p-8 text-white relative overflow-hidden">
          <div className="absolute right-[-40px] top-[-40px] w-40 h-40 bg-sage-green/100/20 rounded-full blur-2xl" />

          <div className="relative z-10">
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

            <p className="text-[10px] uppercase tracking-widest text-sage-green/80 font-black">
              Secure Admin Access
            </p>

            <h1 className="text-3xl font-black mt-2">
              Wear Right Admin
            </h1>

            <p className="text-sm text-slate-300 font-semibold mt-3">
              Enter admin password to manage products, orders, bookings and face scan records.
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-5">
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
              Admin Password
            </label>

            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />

              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter admin password"
                className="w-full bg-cream-base border border-brand-border/60 rounded-xl py-4 pl-11 pr-12 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            <p className="text-xs text-slate-400 font-semibold mt-2">
              Default password: admin123
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-brand-gold hover:opacity-90 text-white py-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-brand-gold/10"
          >
            <ShieldCheck className="w-4 h-4" />
            Login to Admin Panel
          </button>
        </form>
      </div>
    </div>
  );
}