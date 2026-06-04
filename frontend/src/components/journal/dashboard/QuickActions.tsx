'use client';

import { useRouter } from 'next/navigation';
import { Plus, Upload, History, BarChart3, ChevronRight } from 'lucide-react';

interface Props {
  onAddTrade: () => void;
}

interface ActionCard {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  action: () => void;
  badge?: string;
  disabled?: boolean;
}

export function QuickActions({ onAddTrade }: Props) {
  const router = useRouter();

  const actions: ActionCard[] = [
    {
      label: 'Add Trade',
      description: 'Log a new trade entry',
      icon: Plus,
      color: '#a5b4fc',
      bg: 'rgba(99,102,241,0.08)',
      border: 'rgba(99,102,241,0.18)',
      action: onAddTrade,
      badge: 'Quick',
    },
    {
      label: 'Import CSV',
      description: 'Bulk import history',
      icon: Upload,
      color: '#6ee7b7',
      bg: 'rgba(52,211,153,0.06)',
      border: 'rgba(52,211,153,0.14)',
      action: () => {},
      badge: 'Soon',
      disabled: true,
    },
    {
      label: 'Trade History',
      description: 'Browse full archive',
      icon: History,
      color: '#fbbf24',
      bg: 'rgba(251,191,36,0.06)',
      border: 'rgba(251,191,36,0.14)',
      action: () => router.push('/workspace/history'),
    },
    {
      label: 'Analytics',
      description: 'Deep stats & behaviour',
      icon: BarChart3,
      color: '#f472b6',
      bg: 'rgba(244,114,182,0.06)',
      border: 'rgba(244,114,182,0.14)',
      action: () => router.push('/analytics'),
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Quick Actions</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {actions.map((a) => {
          const IconComp = a.icon;
          return (
            <button
              key={a.label}
              onClick={a.action}
              disabled={a.disabled}
              className={`group relative text-left flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-200 ${
                a.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'
              }`}
              style={{ background: a.bg, border: `1px solid ${a.border}` }}
            >
              {/* Badge */}
              {a.badge && (
                <span
                  className="absolute top-2 right-2 text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded-full"
                  style={{ background: `${a.color}20`, color: a.color }}
                >
                  {a.badge}
                </span>
              )}

              {/* Icon */}
              <span
                className="flex w-7 h-7 items-center justify-center rounded-lg flex-shrink-0"
                style={{ background: `${a.color}18`, color: a.color }}
              >
                <IconComp className="w-3.5 h-3.5" />
              </span>

              {/* Text */}
              <div className="min-w-0">
                <div className="text-[11px] font-black leading-tight">{a.label}</div>
                <div className="text-[9px] text-muted-foreground truncate">{a.description}</div>
              </div>

              {/* Arrow */}
              {!a.disabled && (
                <ChevronRight
                  className="ml-auto w-3 h-3 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5 flex-shrink-0"
                  style={{ color: a.color }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
