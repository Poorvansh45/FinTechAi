'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { validateUsername } from '@/lib/auth/types';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Calendar, Bell, Link2, Sliders } from 'lucide-react';
import { ProfileAvatar } from '@/components/layout/UserMenu';
import { ThemeSegmented } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';

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
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 animate-fadeIn sm:px-6">
      <div>
        <h1 className="text-title text-foreground">Profile &amp; Settings</h1>
        <p className="text-body text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      <section aria-labelledby="settings-account" className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="flex items-center gap-4 mb-6">
          <ProfileAvatar name={user?.username ?? '?'} size={56} />
          <div className="min-w-0">
            <h2 id="settings-account" className="text-heading text-foreground truncate">@{user?.username ?? '—'}</h2>
            <div className="text-body text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden />
              <span className="truncate">{user?.email ?? '—'}</span>
            </div>
            <div className="text-caption text-muted-foreground flex items-center gap-1.5 mt-1">
              <Calendar className="w-3 h-3 shrink-0" aria-hidden />
              Member since {user?.createdAt ? formatDate(user.createdAt) : '—'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveUsername} className="space-y-3 border-t border-neutral-800 pt-5">
          <label htmlFor="settings-username" className="text-label font-medium text-neutral-300 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" aria-hidden /> Username
          </label>
          <input
            id="settings-username"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full bg-background border border-neutral-700 hover:border-neutral-600 rounded-md px-3 py-2 text-sm text-foreground"
            maxLength={20}
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save username'}
          </button>
        </form>
      </section>

      <section aria-labelledby="settings-appearance" className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 id="settings-appearance" className="text-subheading text-foreground">Appearance</h2>
        <p className="text-caption text-muted-foreground mt-0.5 mb-4">
          Choose a theme, or follow your device. Your choice is remembered on this browser.
        </p>
        <ThemeSegmented />
      </section>

      <section aria-labelledby="settings-soon" className="space-y-3">
        <h2 id="settings-soon" className="text-label font-medium text-neutral-400">Coming soon</h2>
        {[
          { icon: Sliders, title: 'Display preferences', desc: 'Density and terminal layout' },
          { icon: Link2, title: 'Linked brokerage accounts', desc: 'Connect brokers for auto-sync' },
          { icon: Bell, title: 'Notification preferences', desc: 'Alerts for sessions and risk events' },
        ].map((item) => (
          <div key={item.title} className="flex items-center gap-3 rounded-xl border border-dashed border-neutral-700 p-4">
            <item.icon className="w-4 h-4 text-neutral-500 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-body font-medium text-neutral-300">{item.title}</div>
              <div className="text-caption text-muted-foreground">{item.desc}</div>
            </div>
            <Badge variant="outline" className="text-neutral-400">Soon</Badge>
          </div>
        ))}
      </section>
    </div>
  );
}
