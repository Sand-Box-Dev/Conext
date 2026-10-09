import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Database,
  AlertCircle,
  Eye,
  EyeOff,
  UserRound,
  UserCheck,
} from 'lucide-react';
import conextLogo from '../assets/logo/conext-logo-256.webp';
import { api } from '../services/api';
import type { UserProfile } from '../types';

interface AuthModalProps {
  onSuccess: (user: UserProfile) => void;
  onContinueAsGuest?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onContinueAsGuest }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pendingSignupName, setPendingSignupName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    if (mode === 'signup' && !displayName.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const res = await api.login(email.trim(), password);
        if (pendingSignupName) {
          const user = await api.updateProfile({ display_name: pendingSignupName });
          setPendingSignupName('');
          onSuccess(user);
        } else {
          onSuccess(res.user);
        }
      } else {
        const res = await api.signUp(email.trim(), password);
        if (res.access_token) {
          const user = await api.updateProfile({ display_name: displayName.trim() });
          onSuccess(user);
        } else {
          setPendingSignupName(displayName.trim());
          setNotice('Account registered! Check your email if confirmation is required, then sign in to finish setup.');
          setMode('login');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#0b0f17] relative overflow-hidden select-none p-4">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-slate-500/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-slate-500/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-slate-500/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Main Container Card */}
      <div className="relative w-full max-w-md bg-slate-900/80 backdrop-blur-2xl border border-slate-800/80 rounded-2xl shadow-2xl p-8 z-10 transition-all">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <img src={conextLogo} alt="" className="mb-4 h-20 w-20 rounded-2xl object-contain" />

          <h1 className="text-3xl font-bold tracking-tight text-white">
            Notepad AI
          </h1>
        </div>

        {/* Mode Selector Tabs */}
        <div className="mb-6 flex justify-center gap-2" role="tablist" aria-label="Account access">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`auth-mode-toggle rounded-lg px-4 py-2 text-sm transition-colors ${
              mode === 'login'
                ? 'bg-slate-900 text-white shadow-sm shadow-black/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`auth-mode-toggle rounded-lg px-4 py-2 text-sm transition-colors ${
              mode === 'signup'
                ? 'bg-slate-900 text-white shadow-sm shadow-black/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create account
          </button>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="mb-5 flex items-start gap-3 p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="mb-5 flex items-start gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-400 text-sm">
            <UserCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Name
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={80}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                  className="auth-input !text-[#202632] w-full rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none transition-all"
                />
              </div>
            </div>
          )}
          {/* Email Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@conext.ai"
                className="auth-input !text-[#202632] w-full rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="auth-input !text-[#202632] w-full rounded-xl py-2.5 pl-10 pr-10 text-sm focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Signup only) */}
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="auth-input !text-[#202632] w-full rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="auth-submit w-full mt-2 flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-medium shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Processing...
              </span>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign in' : 'Create account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Continue as Guest option */}
        {onContinueAsGuest && (
          <div className="mt-4 pt-4 text-center">
            <button
              type="button"
              onClick={onContinueAsGuest}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1.5"
            >
              <span>Explore as Guest</span>
            </button>
          </div>
        )}

        {/* Footer Feature Badges */}
        <div className="mt-8 pt-6 grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
          <div className="flex flex-col items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-slate-500" />
            <span>Supabase Auth</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Cpu className="w-4 h-4 text-slate-500" />
            <span>Local AI</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Database className="h-6 w-6" />
            <span>Postgres DB</span>
          </div>
        </div>
      </div>
    </div>
  );
};
