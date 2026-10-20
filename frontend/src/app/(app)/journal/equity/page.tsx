'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Landmark, Plus, Sparkles, TrendingUp, TrendingDown, Wallet,
  Layers, FileText, Ticket, LogOut, Trash2, PencilLine, Lock, X,
} from 'lucide-react';

import {
  listHoldings, listIpos, listNotes,
  addHolding, addLot, addExit, updateHolding, deleteHolding,
  addIpo, updateIpo, deleteIpo,
  addNote, deleteNote,
  holdingMetrics, portfolioTotals,
  type Holding, type IpoApplication, type InvestmentNote,
  type BuySource, type Conviction, type IpoStatus,
} from '@/lib/journal/equity-storage';

// ── Formatting ───────────────────────────────────────────────────────────────
const inr = (v: number | null | undefined) =>
  v == null ? '—' : `₹${Math.round(v).toLocaleString('en-IN')}`;
const pct = (v: number | null | undefined) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const tone = (v: number | null | undefined) =>
  v == null ? 'text-neutral-500' : v > 0 ? 'text-positive-400' : v < 0 ? 'text-negative-400' : 'text-neutral-300';
const today = () => new Date().toISOString().slice(0, 10);

type Tab = 'holdings' | 'ipos' | 'exits' | 'notes';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'holdings', label: 'Holdings',  icon: Layers },
  { id: 'ipos',     label: 'IPOs',      icon: Ticket },
  { id: 'exits',    label: 'Exits',     icon: LogOut },
  { id: 'notes',    label: 'Notes',     icon: FileText },
];

const IPO_STATUS_TONE: Record<IpoStatus, string> = {
  Applied:        'border-warning-500/30 bg-warning-500/10 text-warning-300',
  Allotted:       'border-positive-500/30 bg-positive-500/10 text-positive-300',
  'Not Allotted': 'border-neutral-500/30 bg-neutral-500/10 text-neutral-400',
  Withdrawn:      'border-neutral-500/30 bg-neutral-500/10 text-neutral-500',
};

const CONVICTION_TONE: Record<Conviction, string> = {
  Core:      'border-brand-500/30 bg-brand-500/10 text-brand-300',
  Satellite: 'border-brand-500/30 bg-brand-500/10 text-brand-300',
  Tactical:  'border-warning-500/30 bg-warning-500/10 text-warning-300',
};

// ── Small shared pieces ──────────────────────────────────────────────────────
function Section({ title, subtitle, action, children }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  'h-10 w-full rounded-lg border border-foreground/[0.08] bg-black/30 px-3 text-sm text-foreground outline-none ' +
  'transition-colors placeholder:text-neutral-500 focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8" onClick={onClose}>
      <div
        className="glass-card w-full max-w-lg p-6 animate-fadeUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-neutral-500 transition-colors hover:bg-foreground/5 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EmptyPanel({ icon: Icon, title, body, action }: {
  icon: React.ElementType; title: string; body: string; action?: React.ReactNode;
}) {
  return (
    <div className="glass-card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ background: 'rgb(var(--brand-500) / 0.08)', border: '1px solid rgb(var(--brand-500) / 0.15)' }}>
        <Icon className="h-5 w-5 text-brand-400" />
      </div>
      <p className="text-sm font-semibold text-neutral-300">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-neutral-500">{body}</p>
      {action}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function EquityJournalPage() {
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<Tab>('holdings');

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [ipos, setIpos] = useState<IpoApplication[]>([]);
  const [notes, setNotes] = useState<InvestmentNote[]>([]);

  const [showBuy, setShowBuy] = useState(false);
  const [showIpo, setShowIpo] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [exitFor, setExitFor] = useState<Holding | null>(null);
  const [priceFor, setPriceFor] = useState<Holding | null>(null);

  const refresh = useCallback(() => {
    setHoldings(listHoldings());
    setIpos(listIpos());
    setNotes(listNotes());
  }, []);

  useEffect(() => { refresh(); }, [refresh, version]);
  const bump = () => setVersion((v) => v + 1);

  const totals = useMemo(() => portfolioTotals(holdings), [holdings]);
  const openHoldings = holdings.filter((h) => holdingMetrics(h).openQty > 0);
  const exitedRows = holdings.flatMap((h) => h.exits.map((e) => ({ holding: h, exit: e })))
    .sort((a, b) => b.exit.date.localeCompare(a.exit.date));

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 pb-20 sm:px-8 lg:px-10 animate-fadeIn">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <header className="border-b border-foreground/[0.06] py-12 text-center lg:py-16">
        <div className="flex items-center justify-center gap-2.5">
          <Landmark className="h-4 w-4 text-brand-400" />
          <span className="text-[11px] font-bold text-brand-400">Workspace</span>
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Equity Journal</h1>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-neutral-400 lg:text-[15px]">
          Long-term conviction tracking — purchase records, IPO allotments,
          holdings, exits and the reasoning behind each one.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={() => setShowBuy(true)}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all hover:scale-[1.03] active:scale-95"
            style={{ background: 'rgb(var(--brand-600))', boxShadow: 'none' }}
          >
            <Plus className="h-4 w-4" /> Record Buy
          </button>
          <button
            onClick={() => setShowIpo(true)}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-brand-400 transition-all hover:bg-brand-400/10"
            style={{ background: 'rgb(var(--brand-500) / 0.06)', border: '1px solid rgb(var(--brand-500) / 0.18)' }}
          >
            <Ticket className="h-3.5 w-3.5" /> Log IPO
          </button>
          <button
            onClick={() => setShowNote(true)}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-neutral-300 transition-all hover:bg-foreground/[0.06]"
            style={{ background: 'rgb(var(--foreground) / 0.03)', border: '1px solid rgb(var(--foreground) / 0.07)' }}
          >
            <FileText className="h-3.5 w-3.5" /> Add Note
          </button>
        </div>

        {/* Glance row */}
        {openHoldings.length > 0 && (
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4 sm:divide-x sm:divide-foreground/[0.06]">
            {[
              { label: 'Invested', value: inr(totals.invested), sub: `${totals.openPositions} position${totals.openPositions === 1 ? '' : 's'}`, cls: 'text-foreground' },
              { label: 'Current Value', value: inr(totals.currentValue), sub: totals.unpricedPositions ? `${totals.unpricedPositions} unpriced` : 'all priced', cls: 'text-foreground' },
              { label: 'Unrealised', value: inr(totals.unrealisedPnl), sub: pct(totals.unrealisedPct), cls: tone(totals.unrealisedPnl) },
              { label: 'Realised', value: inr(totals.realisedPnl), sub: 'booked to date', cls: tone(totals.realisedPnl) },
            ].map((s) => (
              <div key={s.label} className="px-2 sm:px-4">
                <div className="text-[11px] font-bold text-neutral-500">{s.label}</div>
                <div className={`mt-2 text-xl font-bold leading-none tabular-nums ${s.cls}`}>{s.value}</div>
                <div className="mt-1.5 text-[11px] text-neutral-500">{s.sub}</div>
              </div>
            ))}
          </div>
        )}
      </header>

      <div className="mt-12 space-y-10">

        {/* ── Tabs ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-foreground/[0.06] pb-px">
          {TABS.map(({ id, label, icon: Icon }) => {
            const on = tab === id;
            const count =
              id === 'holdings' ? openHoldings.length :
              id === 'ipos' ? ipos.length :
              id === 'exits' ? exitedRows.length : notes.length;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 rounded-t-md border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors duration-200 ${
                  on
                    ? 'border-brand-400 bg-brand-500/[0.08] text-brand-200'
                    : 'border-transparent text-neutral-500 hover:border-brand-500/30 hover:bg-brand-500/[0.05] hover:text-neutral-200'
                }`}
              >
                <Icon size={15} strokeWidth={1.75} className={on ? 'text-brand-300' : 'text-neutral-500'} />
                {label}
                <span className={`rounded-md px-1.5 py-px text-[11px] font-bold tabular-nums ${
                  on ? 'bg-brand-500/20 text-brand-200' : 'bg-foreground/[0.05] text-neutral-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Holdings ───────────────────────────────────────────── */}
        {tab === 'holdings' && (
          <Section title="Holdings Tracker" subtitle="Open positions, average cost and unrealised return">
            {openHoldings.length === 0 ? (
              <EmptyPanel
                icon={Wallet}
                title="No open holdings yet"
                body="Record your first purchase to start tracking cost basis, allocation and unrealised return over time."
                action={
                  <button onClick={() => setShowBuy(true)}
                    className="mt-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-500">
                    Record a Buy
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
                {openHoldings.map((h) => {
                  const m = holdingMetrics(h);
                  return (
                    <div key={h.id} className="glass-card group flex flex-col gap-4 p-6">
                      {/* head */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-lg font-bold tracking-wide text-foreground">{h.symbol}</h3>
                            <span className={`flex-shrink-0 rounded-md border px-2 py-px text-[11px] font-bold ${CONVICTION_TONE[h.conviction]}`}>
                              {h.conviction}
                            </span>
                          </div>
                          {h.companyName && <p className="mt-0.5 truncate text-xs text-neutral-500">{h.companyName}</p>}
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button onClick={() => setPriceFor(h)} title="Update price"
                            className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-foreground/5 hover:text-foreground">
                            <PencilLine className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setExitFor(h)} title="Record exit"
                            className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-foreground/5 hover:text-warning-300">
                            <LogOut className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => { if (confirm(`Delete ${h.symbol} and all its records?`)) { deleteHolding(h.id); bump(); } }}
                            title="Delete holding"
                            className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-foreground/5 hover:text-negative-400">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* value */}
                      <div>
                        <div className="text-[11px] font-bold text-neutral-500">Current Value</div>
                        <div className="mt-1.5 flex items-baseline gap-2.5">
                          <span className="text-2xl font-bold tabular-nums text-foreground">{inr(m.currentValue)}</span>
                          {m.unrealisedPct != null && (
                            <span className={`flex items-center gap-1 text-sm font-bold tabular-nums ${tone(m.unrealisedPnl)}`}>
                              {(m.unrealisedPnl ?? 0) >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                              {pct(m.unrealisedPct)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-neutral-500">
                          {m.currentValue == null
                            ? 'No price recorded — add one to value this holding'
                            : `${inr(m.unrealisedPnl)} unrealised`}
                        </div>
                      </div>

                      {/* facts */}
                      <div className="grid grid-cols-3 gap-3 rounded-xl border border-foreground/[0.06] bg-neutral-950/20 p-4">
                        {[
                          { k: 'Qty', v: String(m.openQty) },
                          { k: 'Avg Cost', v: inr(m.avgCost) },
                          { k: 'Invested', v: inr(m.investedValue) },
                        ].map((f) => (
                          <div key={f.k}>
                            <div className="text-[11px] text-neutral-500">{f.k}</div>
                            <div className="mt-0.5 font-mono text-[13px] font-semibold text-neutral-200">{f.v}</div>
                          </div>
                        ))}
                      </div>

                      {/* buy record */}
                      <div>
                        <div className="mb-2 text-[11px] font-bold text-neutral-500">
                          Buy Record · {h.lots.length} lot{h.lots.length === 1 ? '' : 's'}
                        </div>
                        <div className="space-y-1">
                          {h.lots.map((l) => (
                            <div key={l.id} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-neutral-500">{l.date}</span>
                              <span className="font-mono text-neutral-300">
                                {l.quantity} @ {inr(l.price)}
                              </span>
                              <span className="rounded border border-foreground/[0.08] px-1.5 py-px text-[11px] text-neutral-500">{l.source}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {m.realisedPnl !== 0 && (
                        <div className="rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2 text-[11px]">
                          <span className="text-neutral-500">Realised so far </span>
                          <span className={`font-mono font-bold ${tone(m.realisedPnl)}`}>{inr(m.realisedPnl)}</span>
                        </div>
                      )}

                      {h.thesis && (
                        <p className="border-t border-foreground/[0.06] pt-3 text-[11px] leading-relaxed text-neutral-400">
                          {h.thesis}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* ── IPOs ───────────────────────────────────────────────── */}
        {tab === 'ipos' && (
          <Section
            title="IPO Applications"
            subtitle="Applied, allotted and listing outcomes"
            action={
              <button onClick={() => setShowIpo(true)}
                className="rounded-lg border border-brand-500/20 bg-brand-500/[0.08] px-3 py-1.5 text-xs font-semibold text-brand-300 transition-colors hover:bg-brand-500/15">
                + Log IPO
              </button>
            }
          >
            {ipos.length === 0 ? (
              <EmptyPanel
                icon={Ticket}
                title="No IPO applications logged"
                body="Track what you applied for, how much was allotted, and how it listed — so allotment luck and listing gains stay separate from your own stock picking."
              />
            ) : (
              <div className="glass-card overflow-x-auto p-2">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="text-[11px] text-neutral-500">
                      <th className="px-4 py-3 text-left font-bold">Symbol</th>
                      <th className="px-4 py-3 text-left font-bold">Applied</th>
                      <th className="px-4 py-3 text-right font-bold">Lots</th>
                      <th className="px-4 py-3 text-right font-bold">Amount</th>
                      <th className="px-4 py-3 text-center font-bold">Status</th>
                      <th className="px-4 py-3 text-right font-bold">Allotted</th>
                      <th className="px-4 py-3 text-right font-bold">Listing</th>
                      <th className="px-4 py-3 text-right font-bold">Listing P&amp;L</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {ipos.map((i) => {
                      const applied = i.lots * i.lotSize * i.pricePerShare;
                      const listingPnl =
                        i.status === 'Allotted' && i.listingPrice != null && i.allottedQty
                          ? (i.listingPrice - i.pricePerShare) * i.allottedQty
                          : null;
                      return (
                        <tr key={i.id} className="border-t border-foreground/[0.05] transition-colors hover:bg-foreground/[0.02]">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{i.symbol}</div>
                            {i.companyName && <div className="text-[11px] text-neutral-500">{i.companyName}</div>}
                          </td>
                          <td className="px-4 py-3 text-neutral-400">{i.appliedDate}</td>
                          <td className="px-4 py-3 text-right font-mono text-neutral-300">{i.lots}</td>
                          <td className="px-4 py-3 text-right font-mono text-neutral-300">{inr(applied)}</td>
                          <td className="px-4 py-3 text-center">
                            <select
                              value={i.status}
                              onChange={(e) => { updateIpo(i.id, { status: e.target.value as IpoStatus }); bump(); }}
                              className={`cursor-pointer rounded-md border bg-transparent px-2 py-1 text-[11px] font-bold outline-none ${IPO_STATUS_TONE[i.status]}`}
                            >
                              {(['Applied', 'Allotted', 'Not Allotted', 'Withdrawn'] as IpoStatus[]).map((s) => (
                                <option key={s} value={s} className="bg-neutral-900 text-foreground">{s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-neutral-300">{i.allottedQty ?? '—'}</td>
                          <td className="px-4 py-3 text-right font-mono text-neutral-300">{i.listingPrice != null ? inr(i.listingPrice) : '—'}</td>
                          <td className={`px-4 py-3 text-right font-mono font-bold ${tone(listingPnl)}`}>
                            {listingPnl == null ? '—' : inr(listingPnl)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => { if (confirm(`Delete the ${i.symbol} IPO record?`)) { deleteIpo(i.id); bump(); } }}
                              className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-foreground/5 hover:text-negative-400">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {/* ── Exits ──────────────────────────────────────────────── */}
        {tab === 'exits' && (
          <Section title="Exit Record" subtitle="Every sale, with the reason the thesis ended">
            {exitedRows.length === 0 ? (
              <EmptyPanel
                icon={LogOut}
                title="No exits recorded"
                body="When you sell, log the reason alongside the price. Re-reading why you exited is the part that improves the next decision — the price alone never does."
              />
            ) : (
              <div className="space-y-4">
                {exitedRows.map(({ holding, exit }) => {
                  const m = holdingMetrics(holding);
                  const proceeds = exit.quantity * exit.price - (exit.charges ?? 0);
                  const cost = exit.quantity * (m.avgCost ?? 0);
                  const pnl = proceeds - cost;
                  const pnlPct = cost > 0 ? (pnl / cost) * 100 : null;
                  return (
                    <div key={exit.id} className="glass-card p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-foreground">{holding.symbol}</h3>
                            <span className="text-xs text-neutral-500">{exit.date}</span>
                          </div>
                          <p className="mt-1 font-mono text-xs text-neutral-400">
                            Sold {exit.quantity} @ {inr(exit.price)} · cost basis {inr(m.avgCost)}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`text-xl font-bold tabular-nums ${tone(pnl)}`}>{inr(pnl)}</div>
                          <div className={`text-xs font-semibold tabular-nums ${tone(pnl)}`}>{pct(pnlPct)}</div>
                        </div>
                      </div>
                      {exit.reason && (
                        <p className="mt-4 border-t border-foreground/[0.06] pt-3 text-[12px] leading-relaxed text-neutral-400">
                          <span className="font-semibold text-neutral-300">Why: </span>{exit.reason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* ── Notes ──────────────────────────────────────────────── */}
        {tab === 'notes' && (
          <Section
            title="Investment Notes"
            subtitle="Thesis, risks and review notes, dated"
            action={
              <button onClick={() => setShowNote(true)}
                className="rounded-lg border border-brand-500/20 bg-brand-500/[0.08] px-3 py-1.5 text-xs font-semibold text-brand-300 transition-colors hover:bg-brand-500/15">
                + Add Note
              </button>
            }
          >
            {notes.length === 0 ? (
              <EmptyPanel
                icon={FileText}
                title="No notes yet"
                body="Write down the thesis when you buy, not after. A note written before the outcome is known is the only honest record of what you actually thought."
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {notes.map((n) => (
                  <div key={n.id} className="glass-card group p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {n.symbol && (
                          <span className="rounded border border-brand-500/25 bg-brand-500/10 px-1.5 py-px text-[11px] font-bold text-brand-300">
                            {n.symbol}
                          </span>
                        )}
                        {n.tag && (
                          <span className="rounded border border-foreground/[0.08] px-1.5 py-px text-[11px] font-semibold text-neutral-400">
                            {n.tag}
                          </span>
                        )}
                        <span className="text-[11px] text-neutral-500">{n.date}</span>
                      </div>
                      <button onClick={() => { deleteNote(n.id); bump(); }}
                        className="rounded-lg p-1 text-neutral-500 opacity-0 transition-all hover:text-negative-400 group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-foreground">{n.title}</h3>
                    <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-neutral-400">{n.body}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── AI review placeholder ──────────────────────────────── */}
        <Section title="AI Portfolio Review" subtitle="Not yet available">
          <div className="glass-card relative overflow-hidden p-8" style={{ border: '1px solid rgb(var(--brand-500) / 0.12)' }}>
            <div className="flex flex-wrap items-start gap-5">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'rgb(var(--brand-600))', border: '1px solid rgb(var(--brand-500) / 0.2)' }}>
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-foreground">AI Portfolio Review</h3>
                  <span className="flex items-center gap-1 rounded-md border border-foreground/[0.08] bg-foreground/[0.03] px-2 py-0.5 text-[11px] font-bold text-neutral-400">
                    <Lock className="h-2.5 w-2.5" /> Coming soon
                  </span>
                </div>
                <p className="mt-2 max-w-2xl text-xs leading-relaxed text-neutral-400">
                  Planned: concentration and sector-overlap warnings, drift from your stated thesis,
                  and a re-read of each holding&apos;s notes against how it has actually performed since you wrote them.
                </p>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { t: 'Concentration', d: 'Position and sector weight vs your own limits' },
                    { t: 'Thesis Drift', d: 'Where the story has changed since you bought' },
                    { t: 'Exit Discipline', d: 'Whether you sell for the reasons you said you would' },
                  ].map((c) => (
                    <div key={c.t} className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.02] p-4">
                      <div className="text-[11px] font-bold text-neutral-300">{c.t}</div>
                      <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{c.d}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[11px] text-neutral-500">
                  Nothing here is generated yet — this panel is a placeholder, not a disabled feature.
                </p>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* ── Modals ───────────────────────────────────────────────── */}
      {showBuy && <BuyModal holdings={holdings} onClose={() => setShowBuy(false)} onSaved={() => { setShowBuy(false); bump(); }} />}
      {showIpo && <IpoModal onClose={() => setShowIpo(false)} onSaved={() => { setShowIpo(false); bump(); }} />}
      {showNote && <NoteModal holdings={holdings} onClose={() => setShowNote(false)} onSaved={() => { setShowNote(false); bump(); }} />}
      {exitFor && <ExitModal holding={exitFor} onClose={() => setExitFor(null)} onSaved={() => { setExitFor(null); bump(); }} />}
      {priceFor && <PriceModal holding={priceFor} onClose={() => setPriceFor(null)} onSaved={() => { setPriceFor(null); bump(); }} />}
    </div>
  );
}

// ── Modals ───────────────────────────────────────────────────────────────────

function BuyModal({ holdings, onClose, onSaved }: { holdings: Holding[]; onClose: () => void; onSaved: () => void }) {
  const [symbol, setSymbol] = useState('');
  const [companyName, setCompany] = useState('');
  const [conviction, setConviction] = useState<Conviction>('Core');
  const [source, setSource] = useState<BuySource>('Secondary');
  const [date, setDate] = useState(today());
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [charges, setCharges] = useState('');
  const [thesis, setThesis] = useState('');

  const sym = symbol.trim().toUpperCase();
  // A second buy of something already held becomes another lot on the same
  // holding, so the average cost stays correct instead of forking into two rows.
  const existing = holdings.find((h) => h.symbol === sym);
  const valid = sym.length > 0 && Number(qty) > 0 && Number(price) > 0;

  const submit = () => {
    if (!valid) return;
    const lot = {
      date,
      quantity: Number(qty),
      price: Number(price),
      charges: charges ? Number(charges) : undefined,
      source,
    };
    if (existing) {
      addLot(existing.id, lot);
      if (thesis.trim()) updateHolding(existing.id, { thesis: thesis.trim() });
    } else {
      addHolding({
        symbol: sym,
        companyName: companyName.trim() || undefined,
        conviction,
        lastPrice: Number(price),
        lastPriceAt: today(),
        thesis: thesis.trim() || undefined,
        lots: [{ ...lot, id: Math.random().toString(36).slice(2) }],
      });
    }
    onSaved();
  };

  return (
    <Modal title="Record a Buy" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Symbol">
            <input className={inputCls} value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="INFY" autoFocus />
          </Field>
          <Field label="Company (optional)">
            <input className={inputCls} value={companyName} onChange={(e) => setCompany(e.target.value)} placeholder="Infosys Ltd" disabled={!!existing} />
          </Field>
        </div>

        {existing && (
          <p className="rounded-lg border border-brand-500/20 bg-brand-500/[0.06] px-3 py-2 text-[11px] text-brand-200">
            Adding a second lot to your existing <strong>{existing.symbol}</strong> holding — average cost will be recalculated.
          </p>
        )}

        <div className="grid grid-cols-3 gap-4">
          <Field label="Date">
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Quantity">
            <input type="number" min="0" className={inputCls} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="100" />
          </Field>
          <Field label="Price ₹">
            <input type="number" min="0" step="0.01" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1450" />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Charges ₹">
            <input type="number" min="0" step="0.01" className={inputCls} value={charges} onChange={(e) => setCharges(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Source">
            <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value as BuySource)}>
              {(['Secondary', 'IPO', 'Bonus', 'Rights', 'Transfer'] as BuySource[]).map((s) => (
                <option key={s} value={s} className="bg-neutral-900">{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Conviction">
            <select className={inputCls} value={conviction} onChange={(e) => setConviction(e.target.value as Conviction)} disabled={!!existing}>
              {(['Core', 'Satellite', 'Tactical'] as Conviction[]).map((c) => (
                <option key={c} value={c} className="bg-neutral-900">{c}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Thesis — why you're buying">
          <textarea
            className={`${inputCls} h-24 resize-none py-2.5`}
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            placeholder="What has to stay true for this to work out?"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-400 transition-colors hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={!valid}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40">
            Save Buy
          </button>
        </div>
      </div>
    </Modal>
  );
}

function IpoModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [symbol, setSymbol] = useState('');
  const [companyName, setCompany] = useState('');
  const [appliedDate, setDate] = useState(today());
  const [lots, setLots] = useState('1');
  const [lotSize, setLotSize] = useState('');
  const [pricePerShare, setPrice] = useState('');
  const [status, setStatus] = useState<IpoStatus>('Applied');
  const [allottedQty, setAllotted] = useState('');
  const [listingPrice, setListing] = useState('');

  const valid = symbol.trim() && Number(lots) > 0 && Number(lotSize) > 0 && Number(pricePerShare) > 0;

  const submit = () => {
    if (!valid) return;
    addIpo({
      symbol: symbol.trim().toUpperCase(),
      companyName: companyName.trim() || undefined,
      appliedDate,
      lots: Number(lots),
      lotSize: Number(lotSize),
      pricePerShare: Number(pricePerShare),
      status,
      allottedQty: allottedQty ? Number(allottedQty) : null,
      listingPrice: listingPrice ? Number(listingPrice) : null,
    });
    onSaved();
  };

  return (
    <Modal title="Log an IPO Application" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Symbol"><input className={inputCls} value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="SWIGGY" autoFocus /></Field>
          <Field label="Company (optional)"><input className={inputCls} value={companyName} onChange={(e) => setCompany(e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <Field label="Applied"><input type="date" className={inputCls} value={appliedDate} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Lots"><input type="number" min="1" className={inputCls} value={lots} onChange={(e) => setLots(e.target.value)} /></Field>
          <Field label="Lot Size"><input type="number" min="1" className={inputCls} value={lotSize} onChange={(e) => setLotSize(e.target.value)} placeholder="38" /></Field>
          <Field label="Price ₹"><input type="number" min="0" className={inputCls} value={pricePerShare} onChange={(e) => setPrice(e.target.value)} placeholder="390" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Status">
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as IpoStatus)}>
              {(['Applied', 'Allotted', 'Not Allotted', 'Withdrawn'] as IpoStatus[]).map((s) => (
                <option key={s} value={s} className="bg-neutral-900">{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Allotted Qty">
            <input type="number" min="0" className={inputCls} value={allottedQty} onChange={(e) => setAllotted(e.target.value)}
              placeholder="—" disabled={status !== 'Allotted'} />
          </Field>
          <Field label="Listing Price ₹">
            <input type="number" min="0" className={inputCls} value={listingPrice} onChange={(e) => setListing(e.target.value)}
              placeholder="—" disabled={status !== 'Allotted'} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-400 transition-colors hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={!valid}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40">
            Save IPO
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ExitModal({ holding, onClose, onSaved }: { holding: Holding; onClose: () => void; onSaved: () => void }) {
  const m = holdingMetrics(holding);
  const [date, setDate] = useState(today());
  const [qty, setQty] = useState(String(m.openQty));
  const [price, setPrice] = useState(holding.lastPrice ? String(holding.lastPrice) : '');
  const [charges, setCharges] = useState('');
  const [reason, setReason] = useState('');

  const q = Number(qty);
  // Selling more than is held would produce a negative position and a nonsense
  // cost basis, so it's blocked at the form rather than corrected afterwards.
  const overSold = q > m.openQty;
  const valid = q > 0 && !overSold && Number(price) > 0;

  const submit = () => {
    if (!valid) return;
    addExit(holding.id, {
      date, quantity: q, price: Number(price),
      charges: charges ? Number(charges) : undefined,
      reason: reason.trim() || undefined,
    });
    onSaved();
  };

  return (
    <Modal title={`Record Exit — ${holding.symbol}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2.5 text-[11px] text-neutral-400">
          Holding <span className="font-mono font-semibold text-neutral-200">{m.openQty}</span> shares
          at an average cost of <span className="font-mono font-semibold text-neutral-200">{inr(m.avgCost)}</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Quantity">
            <input type="number" min="0" max={m.openQty} className={inputCls} value={qty} onChange={(e) => setQty(e.target.value)} />
          </Field>
          <Field label="Price ₹"><input type="number" min="0" step="0.01" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        </div>
        {overSold && (
          <p className="rounded-lg border border-negative-500/25 bg-negative-500/[0.08] px-3 py-2 text-[11px] text-negative-300">
            You only hold {m.openQty} shares.
          </p>
        )}
        <Field label="Charges ₹">
          <input type="number" min="0" step="0.01" className={inputCls} value={charges} onChange={(e) => setCharges(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Why are you exiting?">
          <textarea className={`${inputCls} h-24 resize-none py-2.5`} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Thesis played out / thesis broke / needed the capital / better opportunity…" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-400 transition-colors hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={!valid}
            className="rounded-lg bg-warning-700 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-warning-700 disabled:cursor-not-allowed disabled:opacity-40">
            Record Exit
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PriceModal({ holding, onClose, onSaved }: { holding: Holding; onClose: () => void; onSaved: () => void }) {
  const [price, setPrice] = useState(holding.lastPrice != null ? String(holding.lastPrice) : '');
  const [target, setTarget] = useState(holding.targetPrice != null ? String(holding.targetPrice) : '');

  const submit = () => {
    updateHolding(holding.id, {
      lastPrice: price ? Number(price) : null,
      lastPriceAt: price ? today() : null,
      targetPrice: target ? Number(target) : null,
    });
    onSaved();
  };

  return (
    <Modal title={`Update Price — ${holding.symbol}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="rounded-lg border border-foreground/[0.06] bg-foreground/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-neutral-400">
          This page has no live price feed — valuations use the price you record here.
          {holding.lastPriceAt && <> Last updated <span className="text-neutral-300">{holding.lastPriceAt}</span>.</>}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Current Price ₹">
            <input type="number" min="0" step="0.01" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} autoFocus />
          </Field>
          <Field label="Target Price ₹">
            <input type="number" min="0" step="0.01" className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="optional" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-400 transition-colors hover:text-foreground">Cancel</button>
          <button onClick={submit} className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-500">
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function NoteModal({ holdings, onClose, onSaved }: { holdings: Holding[]; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(today());
  const [symbol, setSymbol] = useState('');
  const [tag, setTag] = useState<InvestmentNote['tag']>('Thesis');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const valid = title.trim().length > 0 && body.trim().length > 0;

  const submit = () => {
    if (!valid) return;
    addNote({ date, symbol: symbol || undefined, tag, title: title.trim(), body: body.trim() });
    onSaved();
  };

  return (
    <Modal title="Add Investment Note" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Holding">
            <select className={inputCls} value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              <option value="" className="bg-neutral-900">Portfolio-wide</option>
              {holdings.map((h) => <option key={h.id} value={h.symbol} className="bg-neutral-900">{h.symbol}</option>)}
            </select>
          </Field>
          <Field label="Tag">
            <select className={inputCls} value={tag} onChange={(e) => setTag(e.target.value as InvestmentNote['tag'])}>
              {(['Thesis', 'Risk', 'Review', 'Event'] as const).map((t) => (
                <option key={t} value={t} className="bg-neutral-900">{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Title">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Margins holding up despite input costs" autoFocus />
        </Field>
        <Field label="Note">
          <textarea className={`${inputCls} h-32 resize-none py-2.5`} value={body} onChange={(e) => setBody(e.target.value)}
            placeholder="What changed, what you expect, and what would make you change your mind." />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-400 transition-colors hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={!valid}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40">
            Save Note
          </button>
        </div>
      </div>
    </Modal>
  );
}
