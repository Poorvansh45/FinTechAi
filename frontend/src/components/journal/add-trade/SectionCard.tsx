import type { ReactNode } from "react";

export function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-foreground/10 bg-neutral-950/55">
      <div className="flex h-11 items-center justify-between gap-3 border-b border-foreground/10 px-4">
        <h2 className="text-[11px] font-bold text-neutral-300">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
