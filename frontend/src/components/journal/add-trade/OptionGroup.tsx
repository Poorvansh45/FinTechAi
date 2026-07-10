import { cn } from "@/lib/utils";

export function OptionGroup<T extends string>({
  options,
  value,
  onChange,
  columns = "auto",
}: {
  options: readonly T[];
  value: T | "";
  onChange: (value: T) => void;
  columns?: "auto" | "two" | "three";
}) {
  const gridClass =
    columns === "three"
      ? "grid-cols-3"
      : columns === "two"
        ? "grid-cols-2"
        : "grid-cols-2 sm:grid-cols-4";

  return (
    <div className={cn("grid gap-2", gridClass)}>
      {options.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "min-h-9 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-all duration-300 ease-out",
              active
                ? "border-indigo-400 bg-indigo-500/15 text-indigo-300 shadow-[0_0_18px_rgba(99,102,241,0.18)]"
                : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-indigo-400/40 hover:text-foreground"
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
