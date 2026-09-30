import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Cloud, Loader2, LogOut, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthButtonProps {
  user: User | null;
}

/** Header button: sign in / sign up for cloud sync, or the signed-in email with a sign-out action. */
export default function AuthButton({ user }: AuthButtonProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  if (!supabase) return null;

  if (user) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Cloud size={14} className="text-emerald-400" />
        <span className="hidden sm:inline max-w-[180px] truncate" title={user.email}>{user.email}</span>
        <button onClick={() => supabase!.auth.signOut()} className="p-2 rounded-lg hover:bg-white/5 hover:text-white" title="Sign out">
          <LogOut size={15} />
        </button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase!.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setOpen(false);
      } else {
        const { data, error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (data.session) setOpen(false);
        else setMessage({ kind: 'info', text: 'Account created. Open the confirmation link sent to your email, then sign in.' });
      }
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message || 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="px-3 py-2 rounded-xl text-sm text-zinc-300 hover:text-white hover:bg-white/5 flex items-center gap-1.5">
        <Cloud size={15} />
        <span className="hidden sm:inline">Sign in</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="panel w-full max-w-sm p-6 space-y-4 animate-fadeUp">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg">{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-zinc-400">Save your projects to the cloud and open them on any device.</p>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
            />
            {message && (
              <p className={message.kind === 'error' ? 'text-xs text-rose-300' : 'text-xs text-emerald-300'}>{message.text}</p>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 text-sm justify-center">
              {busy && <Loader2 size={15} className="animate-spin" />}
              {mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
            <p className="text-xs text-center text-zinc-500">
              {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setMessage(null);
                }}
                className="text-violet-400 hover:text-violet-300"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </form>
        </div>
      )}
    </>
  );
}
