import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle,
  UserPlus,
  LogIn,
  Mail,
  KeyRound,
} from 'lucide-react';
import { UserState } from '../types';

interface AuthViewProps {
  user: UserState;
  setUser: React.Dispatch<React.SetStateAction<UserState>>;
}

export default function AuthView({ user, setUser }: AuthViewProps) {
  const [isSignIn, setIsSignIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState(user.isLoggedIn ? user.email : '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(user.isLoggedIn ? user.name : '');
  const [successMsg, setSuccessMsg] = useState('');

  const [forgotMode, setForgotMode] = useState(false);
  const [resetLinkSent, setResetLinkSent] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!email || !password) {
      setSuccessMsg('Please enter your email and password.');
      return;
    }

    if (!isSignIn && !name) {
      setSuccessMsg('Please enter your full name.');
      return;
    }

    if (isSignIn) {
      setUser((prev) => ({
        ...prev,
        email,
        name: prev.name || 'Wear Right Customer',
        isLoggedIn: true,
      }));

      setSuccessMsg('Login successful.');
    } else {
      setUser((prev) => ({
        ...prev,
        email,
        name: name || 'Wear Right Customer',
        isLoggedIn: true,
      }));

      setSuccessMsg('Account created successfully.');
    }

    setTimeout(() => {
      setSuccessMsg('');
    }, 3000);
  };

  const handleSendResetLink = (event: React.FormEvent) => {
    event.preventDefault();

    if (!email) {
      setSuccessMsg('Please enter your email address.');
      return;
    }

    setResetLinkSent(true);
    setSuccessMsg('Reset link sent to your email.');

    setTimeout(() => {
      setSuccessMsg('');
    }, 3000);
  };

  const handleResetPassword = (event: React.FormEvent) => {
    event.preventDefault();

    if (!resetPassword || !confirmResetPassword) {
      setSuccessMsg('Please enter and confirm your new password.');
      return;
    }

    if (resetPassword !== confirmResetPassword) {
      setSuccessMsg('Passwords do not match.');
      return;
    }

    setSuccessMsg('Password reset successfully.');
    setForgotMode(false);
    setResetLinkSent(false);
    setResetPassword('');
    setConfirmResetPassword('');
    setPassword('');
    setIsSignIn(true);

    setTimeout(() => {
      setSuccessMsg('');
    }, 3000);
  };

  const handleBackToLogin = () => {
    setForgotMode(false);
    setResetLinkSent(false);
    setResetPassword('');
    setConfirmResetPassword('');
    setIsSignIn(true);
    setSuccessMsg('');
  };

  const handleSignOut = () => {
    setUser((prev) => ({
      ...prev,
      isLoggedIn: false,
    }));

    setPassword('');
    setSuccessMsg('Signed out successfully.');

    setTimeout(() => {
      setSuccessMsg('');
    }, 3000);
  };

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-gradient-to-br from-slate-50 via-white to-blue-50/40 flex items-center justify-center px-6 py-12 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-2xl"
      >
        <div className="bg-white border border-brand-border/60 rounded-[2rem] shadow-2xl shadow-slate-200/70 overflow-hidden">
          <div className="p-8 sm:p-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-white border border-brand-border/60 shadow-sm flex items-center justify-center overflow-hidden">
                <img
                  src="/brand/wr-icon.png"
                  alt="Wear Right Logo"
                  className="w-14 h-14 object-contain"
                  onError={(event) => {
                    event.currentTarget.src = '/brand/wr-monogram.png';
                  }}
                />
              </div>

              <div className="text-left">
                <h2 className="text-3xl font-black text-brand-dark tracking-tight">
                  Wear Right
                </h2>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-black mt-1">
                  Right Style. Right You.
                </p>
              </div>
            </div>

            {user.isLoggedIn ? (
              <div>
                <h3 className="text-3xl font-black text-brand-dark tracking-tight">
                  You are signed in
                </h3>

                <p className="text-sm text-slate-500 font-semibold mt-2">
                  Your account is active now.
                </p>

                <div className="mt-6 bg-cream-base border border-brand-border/60 rounded-2xl p-5">
                  <p className="text-xs uppercase tracking-widest text-slate-400 font-black">
                    Profile Details
                  </p>

                  <h4 className="text-xl font-black text-brand-dark mt-2">
                    {user.name}
                  </h4>

                  <p className="text-sm text-slate-500 font-semibold mt-1">
                    {user.email}
                  </p>
                </div>

                <button
                  onClick={handleSignOut}
                  className="w-full mt-6 bg-slate-900 hover:bg-blue-600 text-white font-black py-4 rounded-xl uppercase tracking-wider text-xs transition-all cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : forgotMode ? (
              <div>
                <h3 className="text-4xl font-black text-brand-dark tracking-tight">
                  Forgot Password
                </h3>

                <p className="text-sm text-slate-500 font-semibold mt-2 mb-7">
                  Enter your email address and reset your account password.
                </p>

                {!resetLinkSent ? (
                  <form onSubmit={handleSendResetLink} className="space-y-5">
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                        Email Address
                      </label>

                      <div className="relative">
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="customer@gmail.com"
                          className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-4 pr-12 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                        />

                        <Mail className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-brand-gold hover:opacity-90 text-white font-black py-4 rounded-xl uppercase tracking-wider text-sm transition-all cursor-pointer shadow-lg shadow-brand-gold/10"
                    >
                      Send Reset Link
                    </button>

                    <button
                      type="button"
                      onClick={handleBackToLogin}
                      className="w-full bg-cream-card/60 hover:bg-slate-200 text-slate-700 font-black py-4 rounded-xl uppercase tracking-wider text-sm transition-all cursor-pointer"
                    >
                      Back to Login
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-5">
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl p-4 text-sm font-bold flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span>Reset link sent to your email.</span>
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                        New Password
                      </label>

                      <div className="relative">
                        <input
                          type="password"
                          value={resetPassword}
                          onChange={(event) => setResetPassword(event.target.value)}
                          placeholder="Enter new password"
                          className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-4 pr-12 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                        />

                        <KeyRound className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                        Confirm Password
                      </label>

                      <div className="relative">
                        <input
                          type="password"
                          value={confirmResetPassword}
                          onChange={(event) => setConfirmResetPassword(event.target.value)}
                          placeholder="Confirm new password"
                          className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-4 pr-12 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                        />

                        <KeyRound className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-brand-gold hover:opacity-90 text-white font-black py-4 rounded-xl uppercase tracking-wider text-sm transition-all cursor-pointer shadow-lg shadow-brand-gold/10"
                    >
                      Update Password
                    </button>

                    <button
                      type="button"
                      onClick={handleBackToLogin}
                      className="w-full bg-cream-card/60 hover:bg-slate-200 text-slate-700 font-black py-4 rounded-xl uppercase tracking-wider text-sm transition-all cursor-pointer"
                    >
                      Back to Login
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div>
                <h3 className="text-4xl font-black text-brand-dark tracking-tight">
                  {isSignIn ? 'Welcome Back' : 'Create Your Account'}
                </h3>

                <p className="text-sm text-slate-500 font-semibold mt-2 mb-7">
                  {isSignIn
                    ? 'Login to continue your Wear Right experience.'
                    : 'Create your account to save your style preferences and orders.'}
                </p>

                <div className="grid grid-cols-2 gap-2 bg-cream-card/60 border border-brand-border/60 rounded-2xl p-1.5 mb-8">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignIn(true);
                      setForgotMode(false);
                      setSuccessMsg('');
                    }}
                    className={`py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${isSignIn
                        ? 'bg-white text-sage-green shadow-sm'
                        : 'text-slate-500 hover:text-brand-dark'
                      }`}
                  >
                    <LogIn className="w-4 h-4" />
                    Login
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSignIn(false);
                      setForgotMode(false);
                      setSuccessMsg('');
                    }}
                    className={`py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${!isSignIn
                        ? 'bg-white text-sage-green shadow-sm'
                        : 'text-slate-500 hover:text-brand-dark'
                      }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    Sign Up
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5">
                  {!isSignIn && (
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                        Full Name
                      </label>

                      <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Full name"
                        className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                      Email Address
                    </label>

                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="customer@gmail.com"
                      className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">
                      Password
                    </label>

                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter password"
                        className="w-full bg-cream-base border border-brand-border/60 rounded-xl px-4 py-4 pr-12 text-sm font-semibold outline-none focus:ring-2 focus:ring-sage-green/20 focus:border-sage-green"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isSignIn && (
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotMode(true);
                          setResetLinkSent(false);
                          setSuccessMsg('');
                        }}
                        className="text-xs font-black text-sage-green hover:text-sage-green transition-colors"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-brand-gold hover:opacity-90 text-white font-black py-4 rounded-xl uppercase tracking-wider text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-gold/10"
                  >
                    <span>{isSignIn ? 'Login' : 'Create Account'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>


              </div>
            )}

            <AnimatePresence>
              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="mt-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl flex items-center gap-3 text-sm font-bold"
                >
                  <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  <span>{successMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}