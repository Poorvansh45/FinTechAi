"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Plus, Search, Sparkles, X, ChevronRight, Activity, BookOpen } from "lucide-react";
import { listSetups, listTradesBySetup, seedDemo, ensureTradeIdsUnique, deleteTrade, updateTrade } from "@/lib/journal/storage";
import { derive } from "@/lib/journal/types";
import type { Setup, Trade } from "@/lib/journal/types";
import { AIJournalAnalyzer } from "@/components/journal/AIJournalAnalyzer";
import { TradeWizard } from "@/components/journal/TradeWizard";
import { TradeDetailPanel } from "@/components/journal/TradeDetailPanel";

const MARKETS = ["All","Indices","Forex","Stocks","FNO"];
const SESSIONS_F = ["All","London","NY","Asian"];
const RESULTS = ["All","Win","Loss","Open"];

export default function JournalPage() {
  const [setups, setSetups] = useState<Setup[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [selected, setSelected] = useState<Trade|null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [version, setVersion] = useState(0);
  // Filters
  const [filterText, setFilterText] = useState("");
  const [filterMarket, setFilterMarket] = useState("All");
  const [filterSetup, setFilterSetup] = useState("");
  const [filterResult, setFilterResult] = useState("All");
  const [filterSession, setFilterSession] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const refresh = useCallback(()=>{
    const s=listSetups();
    setSetups(s);
    const trades=s.flatMap(x=>listTradesBySetup(x.id))
      .sort((a,b)=>new Date(b.entryAt).getTime()-new Date(a.entryAt).getTime());
    setAllTrades(trades);
  },[]);

  useEffect(()=>{ seedDemo(); ensureTradeIdsUnique(); refresh(); },[refresh,version]);

  const setupName=(id:string)=>setups.find(s=>s.id===id)?.name??"—";

  const filtered=useMemo(()=>{
    return allTrades.filter(t=>{
      if(filterMarket!=="All"&&t.marketType!==filterMarket) return false;
      if(filterSetup&&t.setupId!==filterSetup) return false;
      if(filterText&&!t.instrument.toLowerCase().includes(filterText.toLowerCase())) return false;
      if(filterResult!=="All"){
        if(filterResult==="Open"&&t.exitPrice!=null) return false;
        if(filterResult==="Win"&&(t.exitPrice==null||(derive(t).pnl??0)<=0)) return false;
        if(filterResult==="Loss"&&(t.exitPrice==null||(derive(t).pnl??0)>=0)) return false;
      }
      if(filterSession!=="All"&&!t.comments?.includes(filterSession)) return false;
      if(dateFrom&&new Date(t.entryAt)<new Date(dateFrom)) return false;
      if(dateTo&&new Date(t.entryAt)>new Date(dateTo+"T23:59:59")) return false;
      return true;
    });
  },[allTrades,filterMarket,filterSetup,filterText,filterResult,filterSession,dateFrom,dateTo]);

  const kpi=useMemo(()=>{
    const closed=allTrades.filter(t=>t.exitPrice!=null);
    const pnls=closed.map(t=>derive(t).pnl??0);
    const wins=pnls.filter(p=>p>0).length;
    return {
      total:pnls.reduce((a,b)=>a+b,0),
      wins, losses:closed.length-wins,
      winRate:closed.length?wins/closed.length*100:0,
      count:closed.length,
    };
  },[allTrades]);

  const activeTrades=useMemo(()=>allTrades.filter(t=>t.exitPrice==null),[allTrades]);

  const clearFilters=()=>{
    setFilterText(""); setFilterMarket("All"); setFilterSetup("");
    setFilterResult("All"); setFilterSession("All"); setDateFrom(""); setDateTo("");
  };
  const hasFilters=filterText||filterMarket!=="All"||filterSetup||filterResult!=="All"||filterSession!=="All"||dateFrom||dateTo;

  return (
    <div className="space-y-5 animate-fadeIn pb-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400"/> Trading Journal
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{allTrades.length} entries · {kpi.count} closed</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={()=>setShowAnalyzer(v=>!v)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-indigo-400 transition-all"
            style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)"}}>
            <Sparkles className="w-3.5 h-3.5"/> AI Analyzer
          </button>
          <button onClick={()=>setShowWizard(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:scale-105 transition-all"
            style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)",boxShadow:"0 0 16px rgba(99,102,241,0.3)"}}>
            <Plus className="w-4 h-4"/> New Trade
          </button>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {label:"Total P&L",val:`${kpi.total>=0?"+":""}${kpi.total.toFixed(2)}`,col:kpi.total>=0?"#22c55e":"#ef4444"},
          {label:"Win Rate", val:`${kpi.winRate.toFixed(1)}%`,col:kpi.winRate>=50?"#22c55e":"#f59e0b"},
          {label:"Wins",     val:String(kpi.wins),col:"#22c55e"},
          {label:"Losses",   val:String(kpi.losses),col:"#ef4444"},
        ].map(k=>(
          <div key={k.label} className="kpi-card px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{k.label}</div>
            <div className="text-lg font-bold tabular-nums" style={{color:k.col}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Active Trades Banner */}
      {activeTrades.length>0&&(
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-orange-400"/>
            <span className="text-sm font-semibold">Active Trades</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{background:"rgba(251,146,60,0.15)",color:"#fb923c"}}>
              {activeTrades.length} open
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {activeTrades.map(t=>(
              <div key={t.id} className="flex-shrink-0 rounded-xl p-3 min-w-[180px]"
                style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold">{t.instrument}</span>
                  <span className={t.side==="Buy"?"profit-badge":"loss-badge"}>{t.side}</span>
                </div>
                <div className="text-xs text-muted-foreground">Entry: <span className="font-mono text-foreground">{t.entryPrice}</span></div>
                <div className="flex gap-2 mt-2">
                  <button onClick={()=>{updateTrade(t.id,{exitPrice:t.entryPrice,exitAt:new Date().toISOString()});setVersion(v=>v+1);}}
                    className="text-[10px] px-2 py-1 rounded-lg font-medium" style={{background:"rgba(99,102,241,0.1)",color:"#a5b4fc"}}>
                    Breakeven
                  </button>
                  <button onClick={()=>setSelected(t)}
                    className="text-[10px] px-2 py-1 rounded-lg font-medium" style={{background:"rgba(34,197,94,0.1)",color:"#4ade80"}}>
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Analyzer */}
      {showAnalyzer&&(
        <div className="glass-card p-5 animate-fadeUp">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-400"/> AI Journal Analyzer</h2>
            <button onClick={()=>setShowAnalyzer(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4"/></button>
          </div>
          <AIJournalAnalyzer trades={allTrades} setupName={setupName}/>
        </div>
      )}

      {/* Main split */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* LEFT */}
        <div className="lg:w-[58%] flex flex-col gap-3 min-h-0">
          {/* Filters */}
          <div className="glass-card p-3 space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[140px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
                <input value={filterText} onChange={e=>setFilterText(e.target.value)} placeholder="Search instrument…"
                  className="w-full bg-transparent border border-white/8 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-indigo-500/50 text-foreground placeholder:text-muted-foreground"/>
              </div>
              {[
                {val:filterMarket,set:setFilterMarket,opts:MARKETS,w:"w-24"},
                {val:filterResult,set:setFilterResult,opts:RESULTS,w:"w-20"},
                {val:filterSession,set:setFilterSession,opts:SESSIONS_F,w:"w-24"},
              ].map((f,i)=>(
                <select key={i} value={f.val} onChange={e=>f.set(e.target.value)}
                  className={`${f.w} bg-transparent border border-white/8 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-500/50`}
                  style={{color:"hsl(var(--foreground))"}}>
                  {f.opts.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              ))}
              <select value={filterSetup} onChange={e=>setFilterSetup(e.target.value)}
                className="bg-transparent border border-white/8 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-500/50"
                style={{color:"hsl(var(--foreground))"}}>
                <option value="">All Setups</option>
                {setups.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                className="bg-transparent border border-white/8 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500/50 text-foreground"/>
              <span className="text-xs text-muted-foreground">to</span>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
                className="bg-transparent border border-white/8 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500/50 text-foreground"/>
              {hasFilters&&<button onClick={clearFilters} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><X className="w-3 h-3"/>Clear</button>}
              <span className="text-xs text-muted-foreground ml-auto">{filtered.length} trades</span>
            </div>
          </div>

          {/* Table */}
          <div className="glass-card overflow-hidden" style={{minHeight:320}}>
            <div className="overflow-auto" style={{maxHeight:"55vh"}}>
              <table className="w-full text-xs">
                <thead className="sticky top-0" style={{background:"rgba(8,12,20,0.9)",backdropFilter:"blur(8px)"}}>
                  <tr className="border-b border-white/5">
                    {["Date","Instrument","Side","Setup","Entry","Exit","P&L",""].map(h=>(
                      <th key={h} className="text-left py-3 px-3 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length===0?(
                    <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                      No trades. <button onClick={()=>setShowWizard(true)} className="text-indigo-400 hover:underline">Add one →</button>
                    </td></tr>
                  ):filtered.map((t,i)=>{
                    const m=derive(t); const pnl=m.pnl; const isSel=selected?.id===t.id;
                    return (
                      <tr key={t.id||i} onClick={()=>setSelected(isSel?null:t)}
                        className="trade-row border-b border-white/[0.03] cursor-pointer"
                        style={isSel?{background:"rgba(99,102,241,0.08)",borderLeftColor:"#6366f1"}:{}}>
                        <td className="py-2.5 px-3 tabular-nums text-muted-foreground whitespace-nowrap">
                          {new Date(t.entryAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}
                        </td>
                        <td className="py-2.5 px-3 font-semibold">{t.instrument}</td>
                        <td className="py-2.5 px-3"><span className={t.side==="Buy"?"profit-badge":"loss-badge"}>{t.side}</span></td>
                        <td className="py-2.5 px-3 text-muted-foreground max-w-[100px] truncate">{setupName(t.setupId)}</td>
                        <td className="py-2.5 px-3 tabular-nums">{t.entryPrice}</td>
                        <td className="py-2.5 px-3 tabular-nums">{t.exitPrice??<span className="text-orange-400 text-[10px] font-semibold">OPEN</span>}</td>
                        <td className={`py-2.5 px-3 tabular-nums font-bold ${pnl==null?"text-muted-foreground":pnl>=0?"profit":"loss"}`}>
                          {pnl==null?"—":`${pnl>=0?"+":""}${pnl.toFixed(2)}`}
                        </td>
                        <td className="py-2.5 px-3">
                          <button onClick={e=>{e.stopPropagation();deleteTrade(t.id);setVersion(v=>v+1);if(selected?.id===t.id)setSelected(null);}}
                            className="text-muted-foreground hover:text-red-400 transition-colors p-1 rounded">
                            <X className="w-3 h-3"/>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT: Detail Panel */}
        <div className="lg:flex-1 min-h-0" style={{minHeight:400}}>
          {selected?(
            <TradeDetailPanel trade={selected} setupName={setupName} onClose={()=>setSelected(null)}/>
          ):(
            <div className="glass-card h-full flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.15)"}}>
                <ChevronRight className="w-6 h-6 text-indigo-400"/>
              </div>
              <div>
                <p className="text-sm font-medium">Select a Trade</p>
                <p className="text-xs text-muted-foreground mt-1">Click any row to view full details + AI insights</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showWizard&&<TradeWizard setups={setups} onClose={()=>setShowWizard(false)} onSaved={()=>{setVersion(v=>v+1);setShowWizard(false);}}/>}
    </div>
  );
}
