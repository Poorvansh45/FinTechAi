"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { DualRangeSlider } from "./DualRangeSlider";
import { Accent, ACCENT, isRangeActive, RangePreset, RangeValue } from "./types";

type RangeFilterProps = {
  label: string;
  value: RangeValue;
  onChange: (next: RangeValue) => void;
  /** Hard bounds for the slider. Typed values are deliberately NOT clamped. */
  min: number;
  max: number;
  step?: number;
  /** Unit shown inside the inputs, e.g. "₹" (prefix) or "%" (suffix). */
  unit?: string;
  unitPosition?: "prefix" | "suffix";
  /** Formats the slider tooltip. */
  format?: (v: number) => string;
  presets?: RangePreset[];
  /** Min-only filter (APIs that expose just a `*_min` param). */
  singleEnded?: boolean;
  accent?: Accent;
  /** Short explanation surfaced on hover. */
  description?: string;
};

const sameRange = (a: RangeValue, b: { min: number | null; max: number | null }) =>
  a.min === b.min && a.max === b.max;

/**
 * One numeric filter: typed min/max boxes on top, slider underneath, optional
 * quick presets. Typing and dragging write the same `RangeValue`, so the two
 * stay in lockstep. An empty box === `null` === "no constraint", which is
 * exactly what every scanner API already expects, so behaviour is unchanged.
 */
export function RangeFilter({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  unitPosition = "suffix",
  format,
  presets,
  singleEnded = false,
  accent = "purple",
  description,
}: RangeFilterProps) {
  const a = ACCENT[accent];
  const fmt = format ?? ((v: number) => `${v}${unit && unitPosition === "suffix" ? unit : ""}`);
  const active = isRangeActive(value);

  const minRef = useRef<HTMLInputElement>(null);
  const maxRef = useRef<HTMLInputElement>(null);
  const [minText, setMinText] = useState(value.min?.toString() ?? "");
  const [maxText, setMaxText] = useState(value.max?.toString() ?? "");

  // Mirror the value into the boxes whenever it changes elsewhere (slider,
  // preset, clear, reset) — but never while that box is being typed into, so
  // partial input like "-" or "1." is left alone. Focus is read from the DOM
  // rather than tracked in state to avoid a stale guard.
  useEffect(() => {
    if (document.activeElement !== minRef.current) setMinText(value.min?.toString() ?? "");
  }, [value.min]);
  useEffect(() => {
    if (document.activeElement !== maxRef.current) setMaxText(value.max?.toString() ?? "");
  }, [value.max]);

  const handleText = (side: "min" | "max", raw: string) => {
    if (side === "min") setMinText(raw); else setMaxText(raw);
    if (raw.trim() === "") {
      onChange({ ...value, [side]: null });
      return;
    }
    // Typed values are authoritative and intentionally unclamped — a trader may
    // need a bound outside the slider's convenience range (e.g. a huge volume
    // floor). The handle simply pins to the edge in that case.
    const n = Number(raw);
    if (Number.isFinite(n)) onChange({ ...value, [side]: n });
  };

  // A min above the max is almost always a typo — swap rather than reject.
  const handleBlur = () => {
    if (value.min !== null && value.max !== null && value.min > value.max) {
      onChange({ min: value.max, max: value.min });
    }
  };

  const matchedPreset = presets?.find((p) => sameRange(value, p));
  const showCustom = active && !!presets?.length && !matchedPreset;

  return (
    <div
      className={`rounded-xl border px-3 pb-2 pt-2.5 transition-colors ${
        active ? a.cardOn : "border-gray-800/80 bg-gray-900/30"
      }`}
    >
      {/* label + presets */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <span
            className={`truncate text-[11px] font-bold uppercase tracking-wider ${
              active ? a.text : "text-gray-400"
            }`}
            title={description}
          >
            {label}
          </span>
          {active && (
            <button
              type="button"
              onClick={() => onChange({ min: null, max: null })}
              aria-label={`Clear ${label} filter`}
              title="Clear"
              className="text-gray-600 transition-colors hover:text-gray-300"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {!!presets?.length && (
          <div className="flex flex-wrap justify-end gap-1">
            {presets.map((p) => {
              const on = sameRange(value, p);
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onChange(on ? { min: null, max: null } : { min: p.min, max: p.max })}
                  aria-pressed={on}
                  className={`rounded border px-1.5 py-px text-[10px] font-medium leading-4 transition-colors ${
                    on
                      ? a.chipOn
                      : "border-gray-800 bg-gray-950/60 text-gray-500 hover:border-gray-700 hover:text-gray-300"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
            {showCustom && (
              <span className="rounded border border-gray-700 bg-gray-800/60 px-1.5 py-px text-[10px] font-medium leading-4 text-gray-400">
                Custom
              </span>
            )}
          </div>
        )}
      </div>

      {/* typed bounds */}
      <div className="flex items-center gap-1.5">
        <NumberBox
          inputRef={minRef}
          ariaLabel={`${label} minimum`}
          placeholder={String(min)}
          text={minText}
          onText={(v) => handleText("min", v)}
          onBlur={handleBlur}
          unit={unit}
          unitPosition={unitPosition}
          accentFocus={a.inputFocus}
          bordered={active}
        />
        {!singleEnded ? (
          <>
            <span className="text-[10px] text-gray-600">–</span>
            <NumberBox
              inputRef={maxRef}
              ariaLabel={`${label} maximum`}
              placeholder={String(max)}
              text={maxText}
              onText={(v) => handleText("max", v)}
              onBlur={handleBlur}
              unit={unit}
              unitPosition={unitPosition}
              accentFocus={a.inputFocus}
              bordered={active}
            />
          </>
        ) : (
          <span className="flex-1 text-[10px] text-gray-600">and above</span>
        )}
      </div>

      <DualRangeSlider
        label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        format={fmt}
        singleEnded={singleEnded}
        accent={accent}
      />
    </div>
  );
}

/**
 * Module-scope on purpose: declaring this inside RangeFilter would give it a
 * fresh component identity every render, so React would remount the input and
 * drop focus after a single keystroke.
 */
function NumberBox({
  inputRef,
  ariaLabel,
  placeholder,
  text,
  onText,
  onBlur,
  unit,
  unitPosition,
  accentFocus,
  bordered,
}: {
  inputRef: React.RefObject<HTMLInputElement>;
  ariaLabel: string;
  placeholder: string;
  text: string;
  onText: (v: string) => void;
  onBlur: () => void;
  unit?: string;
  unitPosition: "prefix" | "suffix";
  accentFocus: string;
  bordered: boolean;
}) {
  const hasPrefix = !!unit && unitPosition === "prefix";
  const hasSuffix = !!unit && unitPosition === "suffix";
  return (
    <div className="relative flex-1">
      {hasPrefix && (
        <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">
          {unit}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={text}
        onChange={(e) => onText(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={`h-7 w-full rounded-md border bg-gray-950/80 text-center font-mono text-xs text-white outline-none transition-colors placeholder:text-gray-600 focus:ring-2 ${
          bordered ? "border-gray-700" : "border-gray-800"
        } ${accentFocus} ${hasPrefix ? "pl-4" : "px-1.5"} ${hasSuffix ? "pr-4" : ""}`}
      />
      {hasSuffix && (
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">
          {unit}
        </span>
      )}
    </div>
  );
}
