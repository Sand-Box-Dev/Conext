import React, { useEffect, useState } from 'react';
import { Check, Keyboard, LoaderCircle, LockKeyhole, UserRound } from 'lucide-react';
import { api } from '../services/api';
import type { UserProfile } from '../types';

interface SettingsProps {
  user?: UserProfile | null;
  modifierLabel: string;
  onUserUpdated?: (user: UserProfile) => void;
}

export const Settings: React.FC<SettingsProps> = ({ user, modifierLabel, onUserUpdated }) => {
  const [name, setName] = useState(user?.display_name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => setName(user?.display_name || ''), [user?.display_name]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const nameChanged = name.trim() !== (user?.display_name || '');
    const passwordChanged = password.length > 0;
    if (!nameChanged && !passwordChanged) return;
    if (passwordChanged && password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    if (passwordChanged && password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateProfile({
        ...(nameChanged ? { display_name: name.trim() } : {}),
        ...(passwordChanged ? { password } : {}),
      });
      onUserUpdated?.(updated);
      setPassword('');
      setConfirmPassword('');
      setSuccess('Settings saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const shortcuts = [
    ['Open command search', `${modifierLabel}+K`],
    ['Search reviewers', '/'],
    ['Recent', `${modifierLabel}+1`],
    ['Library', `${modifierLabel}+2`],
    ['Open Trash', `${modifierLabel}+3`],
    ['Toggle appearance', `${modifierLabel}+D`],
    ['Warm filter', `${modifierLabel}+Shift+D`],
    ['Close dialog', 'Esc'],
  ];

  return <section className="library-page flex-1 overflow-y-auto bg-[#0b0f17]">
    <div className="mx-auto w-full max-w-4xl space-y-8 px-5 py-8 sm:px-9 sm:py-11">
      <div><p className="text-xs font-medium uppercase tracking-widest text-primary">Preferences</p><h2 className="mt-2 text-2xl font-semibold text-base-content">Settings</h2><p className="mt-1 text-sm text-base-content/60">Manage your account and review keyboard shortcuts.</p></div>

      <form onSubmit={save} className="card border border-base-300 bg-base-200/70 shadow-sm">
        <div className="card-body gap-5">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-2 text-primary"><UserRound className="h-5 w-5" /></span><div><h3 className="font-semibold">Account</h3><p className="text-xs text-base-content/60">Change your name or password.</p></div></div>
          {!user ? <div className="alert alert-info text-sm">Sign in to change account details. Keyboard shortcuts are available below.</div> : <>
            <label className="form-control w-full"><span className="label-text mb-2">Display name</span><input className="input input-bordered w-full" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder={user.email || 'Your name'} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-control w-full"><span className="label-text mb-2">New password</span><input className="input input-bordered w-full" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
              <label className="form-control w-full"><span className="label-text mb-2">Confirm new password</span><input className="input input-bordered w-full" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter new password" /></label>
            </div>
            {error && <p role="alert" className="text-sm text-error">{error}</p>}
            {success && <p role="status" className="flex items-center gap-2 text-sm text-success"><Check className="h-4 w-4" />{success}</p>}
            <div className="flex justify-end"><button className="btn btn-primary" type="submit" disabled={saving || (!name.trim() && !password)}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}{saving ? 'Saving…' : 'Save changes'}</button></div>
          </>}
        </div>
      </form>

      <section className="card border border-base-300 bg-base-200/70 shadow-sm"><div className="card-body gap-5">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-2 text-primary"><Keyboard className="h-5 w-5" /></span><div><h3 className="font-semibold">Keyboard shortcuts</h3><p className="text-xs text-base-content/60">Use these to navigate Conext faster.</p></div></div>
        <div className="grid gap-x-8 sm:grid-cols-2">{shortcuts.map(([label, key]) => <div key={label} className="flex items-center justify-between gap-4 border-b border-base-300/70 py-3 text-sm"><span className="text-base-content/75">{label}</span><kbd className="kbd kbd-sm">{key}</kbd></div>)}</div>
      </div></section>
    </div>
  </section>;
};
