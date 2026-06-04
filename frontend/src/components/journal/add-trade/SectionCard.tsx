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
    <section className="rounded-xl border border-white/10 bg-slate-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex h-11 items-center justify-between gap-3 border-b border-white/10 px-4">
        <h2 className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-300">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
