"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders assistant answers as themed GitHub-Flavored Markdown — headings,
 * lists, tables, bold/italic, blockquotes, inline code, and code blocks — all
 * styled to match the existing dark/violet chat UI. Backend prompts are
 * instructed to always return clean Markdown (never raw JSON/Python structures).
 */

function isInlineCode(className: string | undefined, raw: string): boolean {
  if (/language-(\w+)/.test(className || "")) return false; // explicit fenced language -> block
  return !raw.includes("\n"); // no language tag: single line = inline, multi-line = block
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-sm md:text-[15px] font-bold text-white mt-3 mb-1.5 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[13px] md:text-sm font-bold text-white mt-3 mb-1.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-xs md:text-[13px] font-bold text-slate-100 mt-2.5 mb-1 first:mt-0">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-xs md:text-[13px] text-slate-300 leading-relaxed mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 space-y-1 mb-2 last:mb-0 marker:text-violet-400/70">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 space-y-1 mb-2 last:mb-0 marker:text-violet-400/70">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-xs md:text-[13px] text-slate-300 leading-relaxed">{children}</li>
  ),
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-slate-400">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-violet-300 underline underline-offset-2 decoration-violet-500/40 hover:text-violet-200 transition-colors"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-violet-500/40 bg-violet-500/[0.04] pl-3 pr-2 py-1.5 my-2 rounded-r-md text-[11px] md:text-xs text-slate-400 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-white/[0.06] my-3" />,
  code: ({ className, children, ...rest }) => {
    const raw = String(children).replace(/\n$/, "");
    if (isInlineCode(className, raw)) {
      return (
        <code className="px-1.5 py-0.5 rounded-md bg-white/[0.07] border border-white/[0.06] text-violet-300 text-[11px] font-mono">
          {raw}
        </code>
      );
    }
    return (
      <code className={cn("block font-mono text-[11px] text-slate-200 whitespace-pre", className)} {...rest}>
        {raw}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="rounded-xl bg-black/40 border border-white/[0.06] p-3 overflow-x-auto my-2">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2 rounded-lg border border-white/[0.06]">
      <table className="w-full text-[11px] md:text-[12px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/[0.04]">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-white/[0.05]">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-white/[0.02] transition-colors">{children}</tr>,
  th: ({ children }) => (
    <th className="text-left font-semibold text-slate-200 px-3 py-2 whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2 text-slate-300 align-top">{children}</td>,
};

export function MarkdownContent({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("markdown-render", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
