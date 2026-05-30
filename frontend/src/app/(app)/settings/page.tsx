'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { profileInitial, validateUsername } from '@/lib/auth/types';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Calendar, Bell, Link2, Sliders } from 'lucide-react';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function SettingsPage() {
  const { user, updateUsername } = useAuth();
  const { toast } = useToast();
  const [editName, setEditName] = useState(user?.username ?? '');
  const [saving, setSaving] = useState(false);

  const initial = user?.username ? profileInitial(user.username) : '?';

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateUsername(editName);
    if (err) {
      toast({ title: 'Invalid username', description: err, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await updateUsername(editName);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Update failed';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn pb-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Profile &amp; Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account and preferences.</p>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
          >
            {initial}
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">@{user?.username ?? '—'}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              {user?.email ?? '—'}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <Calendar className="w-3 h-3" />
              Member since {user?.createdAt ? formatDate(user.createdAt) : '—'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveUsername} className="space-y-3 border-t border-white/5 pt-5">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Username
          </label>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/8 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-violet-500/50"
            maxLength={20}
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
          >
            {saving ? 'Saving…' : 'Save username'}
          </button>
        </form>
      </div>

      <div className="space-y-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Coming soon</h2>
        {[
          { icon: Sliders, title: 'Profile preferences', desc: 'Theme, density, and terminal layout' },
          { icon: Link2, title: 'Linked brokerage accounts', desc: 'Connect brokers for auto-sync' },
          { icon: Bell, title: 'Notification preferences', desc: 'Alerts for sessions and risk events' },
        ].map((item) => (
          <div key={item.title} className="glass-card p-4 opacity-60">
            <div className="flex items-center gap-3">
              <item.icon className="w-4 h-4 text-slate-500" />
              <div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
