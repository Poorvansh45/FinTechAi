"use client";

import { useCallback, useRef, useState } from "react";
import { Accent, ACCENT, clamp, snapToStep } from "./types";

type Handle = "min" | "max";

type DualRangeSliderProps = {
  min: number;
  max: number;
  step: number;
  /** `null` = unset; the handle rests on its bound but constrains nothing. */
  value: { min: number | null; max: number | null };
  onChange: (next: { min: number | null; max: number | null }) => void;
  format: (v: number) => string;
  /** Only a lower handle (for `*_min`-only APIs like volume_ratio_min). */
  singleEnded?: boolean;
  accent?: Accent;
  label: string;
};

/**
 * Pointer-driven dual-handle slider.
 *
 * Uses pointer capture rather than native <input type="range"> so both handles
 * stay independently grabbable, the drag stays smooth outside the track, and we
 * can render a value tooltip. Handles are real ARIA sliders: focusable, with
 * arrow/Home/End/PageUp/PageDown support. The wheel only adjusts values once the
 * slider has focus, so hovering never hijacks page scrolling.
 */
export function DualRangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  format,
  singleEnded = false,
  accent = "purple",
  label,
}: DualRangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<Handle | null>(null);
  const [active, setActive] = useState<Handle | null>(null);
  const a = ACCENT[accent];

  const lo = value.min ?? min;
  const hi = singleEnded ? max : value.max ?? max;
  const pct = (v: number) => ((clamp(v, min, max) - min) / (max - min)) * 100;

  const commit = useCallback(
    (handle: Handle, raw: number) => {
      const v = snapToStep(clamp(raw, min, max), step, min);
      if (handle === "min") {
        // Never cross the upper handle.
        onChange({ min: Math.min(v, value.max ?? max), max: value.max });
      } else {
        onChange({ min: value.min, max: Math.max(v, value.min ?? min) });
      }
    },
    [min, max, step, onChange, value.min, value.max]
  );

  const valueFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return min;
      const t = clamp((clientX - rect.left) / rect.width, 0, 1);
      return min + t * (max - min);
    },
    [min, max]
  );

  const nearestHandle = useCallback(
    (v: number): Handle => {
      if (singleEnded) return "min";
      return Math.abs(v - lo) <= Math.abs(v - hi) ? "min" : "max";
    },
    [lo, hi, singleEnded]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore clicks that land on a handle — those start their own drag.
    const raw = valueFromClientX(e.clientX);
    const handle = nearestHandle(raw);
    setDragging(handle);
    setActive(handle);
    trackRef.current?.setPointerCapture(e.pointerId);
    commit(handle, raw);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    commit(dragging, valueFromClientX(e.clientX));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(null);
    try {
      trackRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  const onKeyDown = (handle: Handle) => (e: React.KeyboardEvent) => {
    const current = handle === "min" ? lo : hi;
    const big = step * 10;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = current + (e.shiftKey ? big : step);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = current - (e.shiftKey ? big : step);
        break;
      case "PageUp":
        next = current + big;
        break;
      case "PageDown":
        next = current - big;
        break;
      case "Home":
        next = min;
        break;
      case "End":
        next = max;
        break;
      default:
        return;
    }
    e.preventDefault();
    setActive(handle);
    commit(handle, next);
  };

  // Wheel only acts when the slider already holds focus — no scroll hijacking.
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const holder = trackRef.current?.parentElement;
    if (!holder || !holder.contains(document.activeElement)) return;
    const handle = active ?? "min";
    e.preventDefault();
    const current = handle === "min" ? lo : hi;
    commit(handle, current + (e.deltaY < 0 ? step : -step));
  };

  const thumbFor = (handle: Handle) => {
    const v = handle === "min" ? lo : hi;
    return (
      <Thumb
        key={handle}
        handle={handle}
        value={v}
        percent={pct(v)}
        unset={handle === "min" ? value.min === null : value.max === null}
        dragging={dragging === handle}
        showTooltip={dragging === handle || active === handle}
        label={label}
        min={min}
        max={max}
        format={format}
        accentThumb={a.thumb}
        accentRing={a.ring}
        onKeyDown={onKeyDown(handle)}
        onFocus={() => setActive(handle)}
        onBlur={() => setActive((h) => (h === handle ? null : h))}
        onPointerDown={(e) => {
          e.stopPropagation();
          setDragging(handle);
          setActive(handle);
          trackRef.current?.setPointerCapture(e.pointerId);
        }}
      />
    );
  };

  return (
    <div className="px-1 pt-1" onWheel={onWheel}>
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative h-4 cursor-pointer select-none"
        style={{ touchAction: "none" }}
      >
        {/* rail */}
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-gray-800" />
        {/* selected span */}
        <div
          className={`absolute top-1/2 h-1 -translate-y-1/2 rounded-full ${a.fill}`}
          style={{ left: `${pct(lo)}%`, width: `${Math.max(0, pct(hi) - pct(lo))}%` }}
        />
        {thumbFor("min")}
        {!singleEnded && thumbFor("max")}
      </div>
    </div>
  );
}

/**
 * Declared at module scope on purpose: defining this inside DualRangeSlider
 * would give it a new component identity on every render, so React would
 * unmount/remount the thumbs — dropping keyboard focus mid-interaction and
 * churning the DOM during drags.
 */
function Thumb({
  handle,
  value,
  percent,
  unset,
  dragging,
  showTooltip,
  label,
  min,
  max,
  format,
  accentThumb,
  accentRing,
  onKeyDown,
  onFocus,
  onBlur,
  onPointerDown,
}: {
  handle: Handle;
  value: number;
  percent: number;
  unset: boolean;
  dragging: boolean;
  showTooltip: boolean;
  label: string;
  min: number;
  max: number;
  format: (v: number) => string;
  accentThumb: string;
  accentRing: string;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
  onBlur: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={`${label} ${handle === "min" ? "minimum" : "maximum"}`}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPointerDown={onPointerDown}
      className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border shadow-sm outline-none transition-transform duration-100 focus-visible:ring-2 active:cursor-grabbing ${accentThumb} ${accentRing} ${
        dragging ? "scale-125" : "hover:scale-110"
      } ${unset ? "opacity-70" : ""}`}
      style={{ left: `${percent}%`, touchAction: "none" }}
    >
      <span
        className={`pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-gray-700 bg-gray-900 px-1.5 py-0.5 font-mono text-[10px] text-gray-100 shadow-lg transition-all duration-100 ${
          showTooltip ? "opacity-100" : "scale-95 opacity-0"
        }`}
      >
        {format(value)}
      </span>
    </div>
  );
}
