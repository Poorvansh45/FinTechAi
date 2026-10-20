"use client";

import { ReactNode, useState } from "react";
import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Accent, ACCENT } from "./types";

const GRID: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
};

type FilterPanelProps = {
  /** How many filters currently constrain the result set. */
  activeCount: number;
  onReset: () => void;
  children: ReactNode;
  /** Row under the grid — search box, action buttons, etc. */
  footer?: ReactNode;
  columns?: 2 | 3 | 4 | 5;
  accent?: Accent;
  collapsible?: boolean;
};

/**
 * Shared shell for every scanner's filter section: a dense header carrying the
 * active-filter count and a reset, the responsive filter grid, and an optional
 * footer row. Collapsing keeps small screens usable without losing the summary.
 */
export function FilterPanel({
  activeCount,
  onReset,
  children,
  footer,
  columns = 3,
  accent = "purple",
  collapsible = true,
}: FilterPanelProps) {
  const [open, setOpen] = useState(true);
  const a = ACCENT[accent];

  return (
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40">
      {/* header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={() => collapsible && setOpen((v) => !v)}
          className={`flex items-center gap-2 ${collapsible ? "cursor-pointer" : "cursor-default"}`}
          aria-expanded={open}
        >
          <SlidersHorizontal size={13} className="text-neutral-500" />
          <span className="text-[11px] font-bold text-neutral-300">Filters</span>
          {activeCount > 0 && (
            <span className={`rounded-md border px-1.5 py-px text-[11px] font-bold leading-4 ${a.chipOn}`}>
              {activeCount}
            </span>
          )}
          {collapsible && (
            <ChevronDown
              size={13}
              className={`text-neutral-500 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
            />
          )}
        </button>

        <button
          type="button"
          onClick={onReset}
          disabled={activeCount === 0}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-2.5 py-1 text-[11px] font-medium text-neutral-400 transition-colors hover:border-neutral-600 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <RotateCcw size={11} />
          Reset
        </button>
      </div>

      {open && (
        <div className="border-t border-neutral-800/60 p-3">
          <div className={`grid grid-cols-1 gap-2 ${GRID[columns]}`}>{children}</div>
          {footer && <div className="mt-3 border-t border-neutral-800/60 pt-3">{footer}</div>}
        </div>
      )}
    </div>
  );
}

// ── Categorical select ───────────────────────────────────────────────────────

type FilterSelectProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  /** Value that counts as "no constraint" (drives the active styling). */
  defaultValue?: string;
  accent?: Accent;
};

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  defaultValue = "all",
  accent = "purple",
}: FilterSelectProps) {
  const a = ACCENT[accent];
  const active = value !== defaultValue;
  return (
    <div
      className={`rounded-xl border px-3 pb-2.5 pt-2.5 transition-colors ${
        active ? a.cardOn : "border-transparent bg-neutral-950/40"
      }`}
    >
      <span
        className={`mb-2 block text-[11px] font-bold ${
          active ? a.text : "text-neutral-400"
        }`}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`h-7 w-full rounded-md border bg-neutral-950/80 px-1.5 text-xs text-foreground outline-none transition-colors focus:ring-2 ${
          active ? "border-neutral-700" : "border-neutral-800"
        } ${a.inputFocus}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Boolean toggle ───────────────────────────────────────────────────────────

type FilterToggleProps = {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
  accent?: Accent;
};

export function FilterToggle({
  label,
  checked,
  onChange,
  description,
  accent = "purple",
}: FilterToggleProps) {
  const a = ACCENT[accent];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      title={description}
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
        checked ? a.cardOn : "border-neutral-800/80 bg-neutral-900/30 hover:border-neutral-700"
      }`}
    >
      <span
        className={`text-[11px] font-bold ${checked ? a.text : "text-neutral-400"}`}
      >
        {label}
      </span>
      <span
        className={`relative h-4 w-7 flex-shrink-0 rounded-full transition-colors ${
          checked ? a.fill : "bg-neutral-600"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-150 ${
            checked ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
