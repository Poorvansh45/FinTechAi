"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/** next-themes only knows the real theme after mount; before that, render a
 *  stable placeholder so server and client markup agree. */
function useThemeState() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return {
    mounted,
    setTheme,
    selected: mounted ? theme ?? "system" : "system",
    resolved: mounted ? resolvedTheme : undefined,
  };
}

/**
 * Header theme control. The icon shows the theme that is actually in effect
 * (sun / moon); the menu shows which preference is selected, including
 * "System" (follows the operating system).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { selected, resolved, setTheme } = useThemeState();
  const Icon = resolved === "dark" ? Moon : Sun;
  const selectedLabel = OPTIONS.find((o) => o.value === selected)?.label ?? "System";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Theme: ${selectedLabel}. Open theme menu`}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors",
            "hover:bg-foreground/[0.06] hover:text-foreground",
            "data-[state=open]:bg-foreground/[0.06] data-[state=open]:text-foreground",
            className
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="px-2 py-1.5 text-label text-muted-foreground">
          Appearance
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={selected} onValueChange={setTheme}>
          {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
            <DropdownMenuRadioItem key={value} value={value} className="gap-2 text-body">
              <OptionIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Inline three-way control for roomy surfaces (mobile drawer, settings). */
export function ThemeSegmented({ className }: { className?: string }) {
  const { selected, setTheme } = useThemeState();

  // Radio-group keyboard model: arrows move and select, only the selected option is in the tab order.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = OPTIONS.findIndex((o) => o.value === selected);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (current + 1) % OPTIONS.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (current - 1 + OPTIONS.length) % OPTIONS.length;
    if (next < 0) return;
    e.preventDefault();
    setTheme(OPTIONS[next].value);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      onKeyDown={onKeyDown}
      className={cn("inline-flex rounded-lg border border-border bg-muted p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = selected === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-label transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
