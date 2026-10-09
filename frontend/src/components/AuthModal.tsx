import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
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
  onSuccess: (user: UserProfile, offline?: boolean) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
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
          onSuccess(user, res.offline);
        } else {
          onSuccess(res.user, res.offline);
        }
      } else {
        const res = await api.signUp(email.trim(), password);
        if (res.access_token) {
          const user = await api.updateProfile({ display_name: displayName.trim() });
          onSuccess(user, res.offline);
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
    <div className="auth-screen flex min-h-screen w-screen items-center justify-center p-4">
      <div className="auth-card card w-full max-w-md border border-slate-200 bg-white shadow-xl">
        <div className="card-body gap-0 p-7 sm:p-9">
        {/* Brand Header */}
        <div className="mb-7 flex flex-col items-center text-center">
          <img src={conextLogo} alt="" className="h-12 w-12 rounded-xl object-contain" />
          <h1 className="mt-3 text-lg font-semibold tracking-tight text-slate-950">Notepad AI</h1>
        </div>

        {/* Mode Selector Tabs */}
        <div className="auth-mode-list mb-6 flex gap-1 rounded-xl p-1" role="tablist" aria-label="Account access">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`auth-mode-toggle flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
            className={`auth-mode-toggle flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Name
              </label>
              <div className="relative">
                <UserRound className="auth-field-icon pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                <input
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={80}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                  className="auth-input input input-bordered w-full rounded-xl pl-10 pr-4 text-sm"
                />
              </div>
            </div>
          )}
          {/* Email Field */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Email address
            </label>
            <div className="relative">
              <Mail className="auth-field-icon pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="auth-input input input-bordered w-full rounded-xl pl-10 pr-4 text-sm"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="relative">
              <Lock className="auth-field-icon pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="auth-input input input-bordered w-full rounded-xl pl-10 pr-11 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="auth-password-toggle absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition-colors"
              >
                {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Signup only) */}
          {mode === 'signup' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="auth-field-icon pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  className="auth-input input input-bordered w-full rounded-xl pl-10 pr-4 text-sm"
                />
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="auth-submit btn btn-neutral mt-3 w-full rounded-xl text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="loading loading-spinner loading-sm" />
                Processing…
              </span>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign in' : 'Create account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        </div>
      </div>
    </div>
  );
};
