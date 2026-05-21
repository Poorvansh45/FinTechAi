"use client";
import { useState, useCallback } from "react";
import { X, Check, ArrowRight, ArrowLeft, TrendingUp, TrendingDown, Moon, Globe, Sun } from "lucide-react";
import { createTrade } from "@/lib/journal/storage";
import type { Setup, MarketType, Side } from "@/lib/journal/types";

const STEPS = ["Basic","Setup","Execution","Logic","Partial","Psychology","Session","Upload","Notes"];
const SETUP_TYPES = ["Demand Zone","Supply Zone","FVG","BOS","CHOCH","OB","Breakout","Reversal"];
const TFS = ["1m","3m","5m","15m","30m","1h","4h","1D"];
const HTF_BIAS = ["Bullish","Bearish","Neutral","Ranging"];
const FOREX = ["XAUUSD","GBPUSD","EURUSD","USDINR","USDJPY","GBPJPY","XAGUSD"];
const INDICES = ["NIFTY","BANKNIFTY","SENSEX","FINNIFTY","MIDCAP"];
const CRYPTO = ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT"];
const EMOTIONS = ["😌 Calm","💪 Confident","😤 FOMO","😰 Fear","🤑 Greedy","😕 Unsure"];
const SESSIONS = [
  { label:"Asian", icon:Moon, time:"5:30–8:30 IST" },
  { label:"London", icon:Globe, time:"13:30–17:30 IST" },
  { label:"NY", icon:Sun, time:"18:30–23:30 IST" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function Inp({ value, onChange, type="text", placeholder="" }: any) {
  return (
    <input type={type} value={value} onChange={(e:any)=>onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-indigo-500/50 text-foreground placeholder:text-muted-foreground" />
  );
}

function Chips({ options, value, onChange, multi=false }: any) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o: string) => {
        const active = multi ? value.includes(o) : value===o;
        return (
          <button key={o} type="button"
            onClick={() => multi ? onChange(active ? value.filter((x:string)=>x!==o) : [...value,o]) : onChange(o)}
            className={`chip ${active?"active":""}`}>{o}</button>
        );
      })}
    </div>
  );
}

export function TradeWizard({ setups, onClose, onSaved }: { setups:Setup[]; onClose:()=>void; onSaved:()=>void }) {
  const [step, setStep] = useState(0);
  // Step 0
  const [market, setMarket] = useState<MarketType>("Indices");
  const [instrument, setInstrument] = useState("");
  const [side, setSide] = useState<Side>("Buy");
  const [setupId, setSetupId] = useState(setups[0]?.id??"");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [time, setTime] = useState(new Date().toISOString().slice(11,16));
  // Step 1
  const [setupType, setSetupType] = useState("");
  const [tf, setTf] = useState("5m");
  const [htfBias, setHtfBias] = useState("Bullish");
  const [tags, setTags] = useState<string[]>([]);
  // Step 2
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [target, setTarget] = useState("");
  const [exit, setExit] = useState("");
  const [qty, setQty] = useState("1");
  // Step 3
  const [whyEntry, setWhyEntry] = useState("");
  const [zoneDesc, setZoneDesc] = useState("");
  const [liqConf, setLiqConf] = useState("");
  // Step 4
  const [partialEnabled, setPartialEnabled] = useState(false);
  const [partial1, setPartial1] = useState("50% at 1R");
  const [partial2, setPartial2] = useState("25% at 2R");
  const [actualClose, setActualClose] = useState("");
  // Step 5
  const [emotion, setEmotion] = useState("");
  const [confidence, setConfidence] = useState(7);
  const [discipline, setDiscipline] = useState(7);
  const [criteriaMet, setCriteriaMet] = useState(false);
  // Step 6
  const [session, setSession] = useState("London");
  // Step 7
  const [beforeImg, setBeforeImg] = useState<string|null>(null);
  const [afterImg, setAfterImg] = useState<string|null>(null);
  // Step 8
  const [mistakes, setMistakes] = useState("");
  const [learnings, setLearnings] = useState("");
  const [notes, setNotes] = useState("");

  const rr = (() => {
    const e=parseFloat(entry),s=parseFloat(sl),t=parseFloat(target);
    if(!e||!s||!t) return null;
    const risk=Math.abs(e-s), reward=Math.abs(t-e);
    return risk>0?(reward/risk).toFixed(2):null;
  })();
  const riskPct = (() => {
    const e=parseFloat(entry),s=parseFloat(sl),q=parseFloat(qty);
    if(!e||!s||!q) return null;
    return (Math.abs(e-s)/e*100).toFixed(2);
  })();
  const pnlPreview = (() => {
    if(!entry||!exit) return null;
    return ((parseFloat(exit)-parseFloat(entry))*(side==="Buy"?1:-1)*parseFloat(qty||"1")).toFixed(2);
  })();

  const canNext = () => {
    if(step===0) return !!instrument;
    if(step===2) return !!entry && !!sl;
    return true;
  };

  const handleImgUpload = (e: React.ChangeEvent<HTMLInputElement>, set: (v:string|null)=>void) => {
    const f = e.target.files?.[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ev => set(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleSave = () => {
    if(!instrument||!entry) return;
    const comments = [
      emotion && `Emotion: ${emotion}`,
      `Confidence: ${confidence}/10`,
      `Discipline: ${discipline}/10`,
      whyEntry && `Entry reason: ${whyEntry}`,
      zoneDesc && `Zone: ${zoneDesc}`,
      liqConf && `Liquidity: ${liqConf}`,
      mistakes && `Mistakes: ${mistakes}`,
      learnings && `Learnings: ${learnings}`,
      notes && `Notes: ${notes}`,
      partialEnabled && `Partial: ${partial1} / ${partial2}`,
    ].filter(Boolean).join(" | ");

    createTrade({
      id:"" as any,
      setupId: setupId||"",
      instrument, marketType:market, side,
      entryPrice: parseFloat(entry),
      exitPrice: exit?parseFloat(exit):null,
      entryAt: new Date(`${date}T${time}:00`).toISOString(),
      exitAt: exit?new Date(`${date}T${time}:00`).toISOString():null,
      quantity: parseFloat(qty)||1,
      comments,
      criteriaMet,
      entryModel: setupType,
      stopLoss: sl ? parseFloat(sl) : undefined,
      target: target ? parseFloat(target) : undefined,
    });
    onSaved();
  };

  const stepContent = () => {
    switch(step) {
      case 0: return (
        <div className="space-y-4 animate-fadeUp">
          <div className="grid grid-cols-4 gap-2">
            {(["Indices","Forex","Stocks","FNO","Crypto"] as MarketType[]).map(m=>(
              <button key={m} type="button" onClick={()=>{setMarket(m);setInstrument("");}}
                className={`py-2 rounded-xl text-xs font-medium border transition-all ${market===m?"border-indigo-500 bg-indigo-500/20 text-indigo-300":"border-white/10 text-muted-foreground hover:border-white/20"}`}>
                {m}
              </button>
            ))}
          </div>
          <Field label="Instrument *">
            {(market==="Forex"||market==="Indices"||market==="Crypto") ? (
              <select value={instrument} onChange={e=>setInstrument(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500/50"
                style={{color:"hsl(var(--foreground))"}}>
                <option value="">Select…</option>
                {(market==="Forex"?FOREX:market==="Crypto"?CRYPTO:INDICES).map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            ) : <Inp value={instrument} onChange={setInstrument} placeholder="e.g. NSE:RELIANCE" />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {(["Buy","Sell"] as Side[]).map(s=>(
              <button key={s} type="button" onClick={()=>setSide(s)}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border transition-all ${side===s?(s==="Buy"?"border-green-500 bg-green-500/15 text-green-400":"border-red-500 bg-red-500/15 text-red-400"):"border-white/10 text-muted-foreground"}`}>
                {s==="Buy"?<TrendingUp className="w-4 h-4"/>:<TrendingDown className="w-4 h-4"/>}
                {s} / {s==="Buy"?"Long":"Short"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><Inp type="date" value={date} onChange={setDate}/></Field>
            <Field label="Time"><Inp type="time" value={time} onChange={setTime}/></Field>
          </div>
          {setups.length>0&&<Field label="Playbook">
            <select value={setupId} onChange={e=>setSetupId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500/50"
              style={{color:"hsl(var(--foreground))"}}>
              <option value="">None</option>
              {setups.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>}
        </div>
      );
      case 1: return (
        <div className="space-y-4 animate-fadeUp">
          <Field label="Setup Type"><Chips options={SETUP_TYPES} value={setupType} onChange={setSetupType}/></Field>
          <Field label="Timeframe"><Chips options={TFS} value={tf} onChange={setTf}/></Field>
          <Field label="HTF Bias"><Chips options={HTF_BIAS} value={htfBias} onChange={setHtfBias}/></Field>
          <Field label="Extra Tags"><Chips options={["FVG","BOS","CHOCH","OB","Liquidity Sweep","Inducement"]} value={tags} onChange={setTags} multi/></Field>
        </div>
      );
      case 2: return (
        <div className="space-y-4 animate-fadeUp">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Entry Price *"><Inp type="number" value={entry} onChange={setEntry}/></Field>
            <Field label="Stop Loss *"><Inp type="number" value={sl} onChange={setSl}/></Field>
            <Field label="Target"><Inp type="number" value={target} onChange={setTarget}/></Field>
            <Field label="Exit Price"><Inp type="number" value={exit} onChange={setExit}/></Field>
          </div>
          <Field label="Lot Size / Qty"><Inp type="number" value={qty} onChange={setQty}/></Field>
          {(rr||riskPct||pnlPreview)&&(
            <div className="rounded-xl p-4 grid grid-cols-3 gap-4" style={{background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.2)"}}>
              {rr&&<div><div className="text-[10px] text-muted-foreground uppercase">R:R</div><div className="text-xl font-bold" style={{color:parseFloat(rr)>=2?"#22c55e":"#f59e0b"}}>1:{rr}</div></div>}
              {riskPct&&<div><div className="text-[10px] text-muted-foreground uppercase">Risk %</div><div className="text-xl font-bold text-orange-400">{riskPct}%</div></div>}
              {pnlPreview&&<div><div className="text-[10px] text-muted-foreground uppercase">P&L</div><div className={`text-xl font-bold ${parseFloat(pnlPreview)>=0?"profit":"loss"}`}>{parseFloat(pnlPreview)>=0?"+":""}{pnlPreview}</div></div>}
            </div>
          )}
        </div>
      );
      case 3: return (
        <div className="space-y-4 animate-fadeUp">
          <Field label="Why did you take this entry?">
            <textarea value={whyEntry} onChange={e=>setWhyEntry(e.target.value)} rows={3} placeholder="Describe the reason for entry…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500/50 text-foreground placeholder:text-muted-foreground resize-none"/>
          </Field>
          <Field label="Zone Description">
            <textarea value={zoneDesc} onChange={e=>setZoneDesc(e.target.value)} rows={2} placeholder="Describe the demand/supply zone…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500/50 text-foreground placeholder:text-muted-foreground resize-none"/>
          </Field>
          <Field label="Liquidity Confirmation">
            <Inp value={liqConf} onChange={setLiqConf} placeholder="e.g. Swept equal highs, inducement taken…"/>
          </Field>
        </div>
      );
      case 4: return (
        <div className="space-y-4 animate-fadeUp">
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
            <input type="checkbox" id="partial" checked={partialEnabled} onChange={e=>setPartialEnabled(e.target.checked)} className="w-4 h-4 accent-indigo-500"/>
            <label htmlFor="partial" className="text-sm cursor-pointer">Enable Partial Close Strategy</label>
          </div>
          {partialEnabled&&(
            <>
              <Field label="First Partial (Planned)"><Inp value={partial1} onChange={setPartial1} placeholder="50% at 1R"/></Field>
              <Field label="Second Partial (Planned)"><Inp value={partial2} onChange={setPartial2} placeholder="25% at 2R"/></Field>
              <Field label="Actual Close (What happened)">
                <textarea value={actualClose} onChange={e=>setActualClose(e.target.value)} rows={2} placeholder="Describe how the trade actually closed…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500/50 text-foreground placeholder:text-muted-foreground resize-none"/>
              </Field>
            </>
          )}
          {!partialEnabled&&<p className="text-sm text-muted-foreground text-center py-6">Check the box above to define a partial close strategy.</p>}
        </div>
      );
      case 5: return (
        <div className="space-y-5 animate-fadeUp">
          <Field label="Emotional State"><Chips options={EMOTIONS} value={emotion} onChange={setEmotion}/></Field>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Confidence: <span className="text-indigo-300 font-bold">{confidence}/10</span></label>
            <input type="range" min={1} max={10} value={confidence} onChange={e=>setConfidence(+e.target.value)} className="w-full accent-indigo-500"/>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>Low</span><span>High</span></div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Discipline: <span className="text-indigo-300 font-bold">{discipline}/10</span></label>
            <input type="range" min={1} max={10} value={discipline} onChange={e=>setDiscipline(+e.target.value)} className="w-full accent-indigo-500"/>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>Low</span><span>High</span></div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
            <input type="checkbox" id="criteria2" checked={criteriaMet} onChange={e=>setCriteriaMet(e.target.checked)} className="w-4 h-4 accent-indigo-500"/>
            <label htmlFor="criteria2" className="text-sm cursor-pointer">All setup criteria were met before entry</label>
          </div>
        </div>
      );
      case 6: return (
        <div className="space-y-4 animate-fadeUp">
          <p className="text-xs text-muted-foreground">Select the session this trade was taken in.</p>
          <div className="grid grid-cols-3 gap-3">
            {SESSIONS.map(s=>(
              <button key={s.label} type="button" onClick={()=>setSession(s.label)}
                className={`flex flex-col items-center gap-2 py-4 rounded-xl border transition-all ${session===s.label?"border-indigo-500 bg-indigo-500/15 text-indigo-300":"border-white/10 text-muted-foreground hover:border-white/20"}`}>
                <s.icon className="w-5 h-5"/>
                <span className="text-sm font-semibold">{s.label}</span>
                <span className="text-[10px] opacity-60">{s.time}</span>
              </button>
            ))}
          </div>
        </div>
      );
      case 7: return (
        <div className="space-y-4 animate-fadeUp">
          <p className="text-xs text-muted-foreground">Upload chart screenshots for before and after the trade.</p>
          {[
            { label:"Before Trade Chart", value:beforeImg, set:setBeforeImg },
            { label:"After Trade Chart",  value:afterImg,  set:setAfterImg },
          ].map(({label,value,set})=>(
            <div key={label}>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">{label}</label>
              {value ? (
                <div className="relative">
                  <img src={value} alt={label} className="w-full rounded-xl" style={{maxHeight:160,objectFit:"cover"}}/>
                  <button type="button" onClick={()=>set(null)} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white">
                    <X className="w-3 h-3"/>
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 p-6 rounded-xl border border-dashed border-white/15 cursor-pointer hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all">
                  <span className="text-2xl">📷</span>
                  <span className="text-xs text-muted-foreground">Click to upload image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e=>handleImgUpload(e,set)}/>
                </label>
              )}
            </div>
          ))}
        </div>
      );
      case 8: return (
        <div className="space-y-4 animate-fadeUp">
          <Field label="Mistakes made">
            <textarea value={mistakes} onChange={e=>setMistakes(e.target.value)} rows={2} placeholder="What went wrong? What could be improved?"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500/50 text-foreground placeholder:text-muted-foreground resize-none"/>
          </Field>
          <Field label="Key Learnings">
            <textarea value={learnings} onChange={e=>setLearnings(e.target.value)} rows={2} placeholder="What did you learn from this trade?"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500/50 text-foreground placeholder:text-muted-foreground resize-none"/>
          </Field>
          <Field label="General Notes">
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Anything else to note…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500/50 text-foreground placeholder:text-muted-foreground resize-none"/>
          </Field>
          <div className="rounded-xl p-3 space-y-1.5" style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.15)"}}>
            <div className="text-xs font-semibold text-indigo-300 mb-2">Trade Summary</div>
            {[[instrument,side],[setupType,tf],[entry?`Entry: ${entry}`:"",[sl?`SL: ${sl}`:"",target?`TP: ${target}`:""]]].flat().filter(Boolean).map((v,i)=>(
              <div key={i} className="text-xs text-muted-foreground">{v}</div>
            ))}
            {rr&&<div className="text-xs text-green-400 font-semibold">R:R 1:{rr}</div>}
          </div>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.75)",backdropFilter:"blur(10px)"}}>
      <div className="w-full max-w-lg flex flex-col glass-card" style={{maxHeight:"88vh",overflow:"hidden"}}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold">New Trade</h2>
            <p className="text-xs text-muted-foreground">Step {step+1}/{STEPS.length}: {STEPS[step]}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4"/></button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-1 px-5 py-3 overflow-x-auto flex-shrink-0">
          {STEPS.map((s,i)=>(
            <div key={s} className="flex items-center gap-1 flex-shrink-0">
              <button type="button" onClick={()=>i<step&&setStep(i)}
                className={`step-dot ${i<step?"completed":i===step?"active":"pending"} ${i<step?"cursor-pointer":""}`}>
                {i<step?<Check className="w-3 h-3"/>:<span className="text-[11px]">{i+1}</span>}
              </button>
              {i<STEPS.length-1&&<div className={`h-px w-4 ${i<step?"bg-indigo-500":"bg-white/10"}`}/>}
            </div>
          ))}
          <span className="ml-2 text-[10px] text-muted-foreground flex-shrink-0 hidden sm:block">{STEPS[step]}</span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{stepContent()}</div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-white/5 flex-shrink-0">
          <button type="button" onClick={()=>step>0?setStep(s=>s-1):onClose()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
            <ArrowLeft className="w-4 h-4"/>{step===0?"Cancel":"Back"}
          </button>
          {step<STEPS.length-1
            ? <button type="button" onClick={()=>setStep(s=>s+1)} disabled={!canNext()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:scale-105 transition-all"
                style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)"}}>
                Next <ArrowRight className="w-4 h-4"/>
              </button>
            : <button type="button" onClick={handleSave} disabled={!instrument||!entry}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 hover:scale-105 transition-all"
                style={{background:"linear-gradient(135deg,#059669,#10b981)"}}>
                <Check className="w-4 h-4"/> Save Trade
              </button>
          }
        </div>
      </div>
    </div>
  );
}
