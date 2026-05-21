'use client';
import { useMemo, useEffect, useState } from 'react';
import Link from 'next/link';
import { DollarSign, Target, Activity, BarChart2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Sparkles, ChevronRight, AlertCircle, CheckCircle2, Zap, Plus } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { listSetups, listTradesBySetup, seedDemo, ensureTradeIdsUnique } from '@/lib/journal/storage';
import { derive } from '@/lib/journal/types';
import type { Trade } from '@/lib/journal/types';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const PERIODS = ['1D','1W','1M','3M','ALL'];
const AI_TIPS = [
  { col:'#22c55e', text:'Win rate peaks on Thursdays — consider prioritising that session.' },
  { col:'#f59e0b', text:'3 consecutive losses on BANKNIFTY. Review your SL discipline.' },
  { col:'#818cf8', text:'FVG setups carry a 68% win rate — your strongest edge.' },
];

function pct(n:number){ return n>=0?`+${n.toFixed(2)}`:`${n.toFixed(2)}`; }

function computeAll(trades:Trade[]){
  const closed=trades.filter(t=>t.exitPrice!=null);
  const open=trades.filter(t=>t.exitPrice==null);
  const pnls=closed.map(t=>derive(t).pnl??0);
  const wins=pnls.filter(p=>p>0); const losses=pnls.filter(p=>p<0);
  const totalPnl=pnls.reduce((a,b)=>a+b,0);
  const realised=totalPnl;
  const winRate=closed.length?wins.length/closed.length*100:0;
  const grossProfit=wins.reduce((a,b)=>a+b,0);
  const grossLoss=Math.abs(losses.reduce((a,b)=>a+b,0));
  const pf=grossLoss>0?grossProfit/grossLoss:grossProfit>0?99:0;
  const avgWin=wins.length?grossProfit/wins.length:0;
  const avgLoss=losses.length?grossLoss/losses.length:0;
  // day of week perf
  const dayMap:Record<number,{sum:number,n:number}>={}; 
  closed.forEach(t=>{const d=new Date(t.entryAt).getDay();const adj=(d+6)%7;if(!dayMap[adj])dayMap[adj]={sum:0,n:0};dayMap[adj].sum+=derive(t).pnl??0;dayMap[adj].n++;});
  // long vs short
  const longs=closed.filter(t=>t.side==='Buy'); const shorts=closed.filter(t=>t.side==='Sell');
  const longPnl=longs.map(t=>derive(t).pnl??0).reduce((a,b)=>a+b,0);
  const shortPnl=shorts.map(t=>derive(t).pnl??0).reduce((a,b)=>a+b,0);
  const longWR=longs.length?longs.filter(t=>(derive(t).pnl??0)>0).length/longs.length*100:0;
  const shortWR=shorts.length?shorts.filter(t=>(derive(t).pnl??0)>0).length/shorts.length*100:0;
  // top symbols
  const symMap:Record<string,{sum:number,n:number}>={}; 
  closed.forEach(t=>{if(!symMap[t.instrument])symMap[t.instrument]={sum:0,n:0};symMap[t.instrument].sum+=derive(t).pnl??0;symMap[t.instrument].n++;});
  const topSyms=Object.entries(symMap).sort((a,b)=>b[1].sum-a[1].sum).slice(0,5);
  return {closed:closed.length,open:open.length,totalPnl,realised,winRate,pf,avgWin,avgLoss,wins:wins.length,losses:losses.length,dayMap,longs,shorts,longPnl,shortPnl,longWR,shortWR,topSyms};
}

function buildCurve(trades:Trade[],period:string){
  const sorted=[...trades].filter(t=>t.exitPrice!=null).sort((a,b)=>new Date(a.entryAt).getTime()-new Date(b.entryAt).getTime());
  const now=Date.now();
  const cutoff:Record<string,number>={'1D':864e5,'1W':7*864e5,'1M':30*864e5,'3M':90*864e5,'ALL':Infinity};
  const filtered=sorted.filter(t=>now-new Date(t.entryAt).getTime()<=cutoff[period]);
  let eq=0;
  return filtered.map((t,i)=>{eq+=derive(t).pnl??0;return{name:new Date(t.entryAt).toLocaleDateString('en-IN',{month:'short',day:'numeric'}),equity:parseFloat(eq.toFixed(2))};});
}

function buildCalendar(trades:Trade[]){
  const map:Record<string,number>={};
  trades.filter(t=>t.exitPrice!=null).forEach(t=>{const k=t.entryAt.slice(0,10);map[k]=(map[k]??0)+(derive(t).pnl??0);});
  return map;
}

const Tip=({active,payload,label}:any)=>{
  if(!active||!payload?.length)return null;
  const v=payload[0]?.value;
  return(<div className="glass-card p-2.5 text-xs" style={{border:'1px solid rgba(99,102,241,0.3)'}}>
    <div className="text-muted-foreground mb-1">{label}</div>
    <div className="font-bold" style={{color:v>=0?'#22c55e':'#ef4444'}}>{pct(v)}</div>
  </div>);
};

export default function DashboardPage(){
  const [trades,setTrades]=useState<Trade[]>([]);
  const [period,setPeriod]=useState('ALL');
  const [mounted,setMounted]=useState(false);

  useEffect(()=>{seedDemo();ensureTradeIdsUnique();const s=listSetups();setTrades(s.flatMap(x=>listTradesBySetup(x.id)));setMounted(true);},[]);

  const s=useMemo(()=>computeAll(trades),[trades]);
  const curve=useMemo(()=>buildCurve(trades,period),[trades,period]);
  const calMap=useMemo(()=>buildCalendar(trades),[trades]);
  const recent=useMemo(()=>[...trades].filter(t=>t.exitPrice!=null).sort((a,b)=>new Date(b.entryAt).getTime()-new Date(a.entryAt).getTime()).slice(0,5),[trades]);
  const openTrades=useMemo(()=>trades.filter(t=>t.exitPrice==null),[trades]);
  const setupNames=useMemo(()=>{const ss=listSetups();return(id:string)=>ss.find(x=>x.id===id)?.name??'—';},[trades]);

  const now=new Date();
  const yr=now.getFullYear(),mo=now.getMonth();
  const firstDay=new Date(yr,mo,1).getDay();
  const daysInMonth=new Date(yr,mo+1,0).getDate();
  const calStart=(firstDay+6)%7;
  const calCells=Array.from({length:calStart+daysInMonth},(_,i)=>i<calStart?null:i-calStart+1);

  if(!mounted)return(<div className="space-y-5 animate-fadeIn">{[...Array(3)].map((_,i)=><div key={i} className="h-28 skeleton rounded-2xl"/>)}</div>);

  const KPIS=[
    {label:'Total P&L',val:pct(s.totalPnl),sub:`${s.closed} trades`,icon:DollarSign,col:'#6366f1',up:s.totalPnl>=0},
    {label:'Unrealized P&L',val:`+$0.00`,sub:`${s.open} open positions`,icon:Activity,col:'#f59e0b',up:true},
    {label:'Realized P&L',val:pct(s.realised),sub:`${s.closed} closed trades`,icon:Target,col:'#22c55e',up:s.realised>=0},
    {label:'Win Rate',val:`${s.winRate.toFixed(1)}%`,sub:`${s.wins}W · ${s.losses}L`,icon:BarChart2,col:'#a78bfa',up:s.winRate>=50},
  ];

  return(
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-xs text-muted-foreground">{now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
        </div>
        <Link href="/journal" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)',boxShadow:'0 0 16px rgba(99,102,241,0.3)'}}>
          <Plus className="w-4 h-4"/> New Trade
        </Link>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPIS.map(k=>(
          <div key={k.label} className="kpi-card p-4 animate-fadeUp">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</div>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{background:`${k.col}15`,border:`1px solid ${k.col}25`}}>
                <k.icon className="w-3.5 h-3.5" style={{color:k.col}}/>
              </div>
            </div>
            <div className="text-xl font-bold tabular-nums mb-0.5" style={{color:k.up?'#22c55e':'#ef4444'}}>{k.val}</div>
            <div className="text-[10px] text-muted-foreground">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Performance Chart + Open Positions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><span className="w-3 h-3 text-indigo-400">↗</span>PERFORMANCE</div>
              <div className={`text-2xl font-bold tabular-nums mt-0.5 ${s.totalPnl>=0?'profit':'loss'}`}>{pct(s.totalPnl)}</div>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}>
              {PERIODS.map(p=>(
                <button key={p} onClick={()=>setPeriod(p)} className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                  style={period===p?{background:'linear-gradient(135deg,#4f46e5,#7c3aed)',color:'white'}:{color:'hsl(var(--muted-foreground))'}}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          {curve.length===0?(
            <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
              <div className="text-3xl mb-2 opacity-20">📈</div>
              <div className="text-sm">No trades taken</div>
              <div className="text-xs mt-1 opacity-60">Complete trades to see performance</div>
            </div>
          ):(
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={curve} margin={{top:4,right:4,left:-24,bottom:0}}>
                  <defs>
                    <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                  <XAxis dataKey="name" tick={{fontSize:9,fill:'#64748b'}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:9,fill:'#64748b'}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<Tip/>}/>
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)"/>
                  <Area type="monotone" dataKey="equity" stroke="#6366f1" strokeWidth={2} fill="url(#dashGrad)" dot={false} activeDot={{r:4,fill:'#6366f1',stroke:'#080c14',strokeWidth:2}}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Open Positions */}
        <div className="glass-card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Open Positions</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{background:'rgba(251,146,60,0.12)',color:'#fb923c'}}>{s.open} open</span>
          </div>
          {openTrades.length===0?(
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <div className="text-2xl mb-2 opacity-20">📭</div>
              <div className="text-xs text-muted-foreground">No open positions</div>
            </div>
          ):(
            <div className="space-y-2 flex-1 overflow-y-auto">
              {openTrades.map(t=>(
                <div key={t.id} className="rounded-xl p-3 flex items-center justify-between" style={{background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.05)'}}>
                  <div>
                    <div className="text-sm font-bold">{t.instrument}</div>
                    <div className="text-[10px] text-muted-foreground">Entry: {t.entryPrice}</div>
                  </div>
                  <span className={t.side==='Buy'?'profit-badge':'loss-badge'}>{t.side}</span>
                </div>
              ))}
            </div>
          )}
          <Link href="/journal" className="mt-3 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium text-indigo-400 transition-colors" style={{background:'rgba(99,102,241,0.07)',border:'1px solid rgba(99,102,241,0.15)'}}>
            View Journal <ChevronRight className="w-3.5 h-3.5"/>
          </Link>
        </div>
      </div>

      {/* Long vs Short + Day Performance + Top Symbols */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Long vs Short */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-4">Long vs Short</h2>
          {[
            {label:'Long',icon:TrendingUp,col:'#22c55e',trades:s.longs.length,pnl:s.longPnl,wr:s.longWR},
            {label:'Short',icon:TrendingDown,col:'#ef4444',trades:s.shorts.length,pnl:s.shortPnl,wr:s.shortWR},
          ].map(r=>(
            <div key={r.label} className="mb-3 rounded-xl p-3" style={{background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.05)'}}>
              <div className="flex items-center gap-2 mb-2">
                <r.icon className="w-3.5 h-3.5" style={{color:r.col}}/>
                <span className="text-xs font-semibold" style={{color:r.col}}>{r.label}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-[9px] text-muted-foreground uppercase">Trades</div><div className="text-sm font-bold">{r.trades}</div></div>
                <div><div className="text-[9px] text-muted-foreground uppercase">P&L</div><div className={`text-sm font-bold tabular-nums ${r.pnl>=0?'profit':'loss'}`}>{pct(r.pnl)}</div></div>
                <div><div className="text-[9px] text-muted-foreground uppercase">Win %</div><div className="text-sm font-bold">{r.wr.toFixed(0)}%</div></div>
              </div>
            </div>
          ))}
        </div>

        {/* Day of Week Performance */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-4">Day Performance</h2>
          <div className="space-y-2">
            {DAYS.map((d,i)=>{
              const dp=s.dayMap[i];
              const val=dp?dp.sum:0;
              const isPos=val>0;
              const maxVal=Math.max(...Object.values(s.dayMap).map(x=>Math.abs(x.sum)),1);
              const barW=dp?Math.abs(dp.sum)/maxVal*100:0;
              return(
                <div key={d} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-7">{d}</span>
                  <div className="flex-1 h-4 rounded-md overflow-hidden" style={{background:'rgba(255,255,255,0.04)'}}>
                    {dp&&<div className="h-full rounded-md transition-all" style={{width:`${barW}%`,background:isPos?'linear-gradient(90deg,#22c55e,#16a34a)':'linear-gradient(90deg,#ef4444,#dc2626)'}}/>}
                  </div>
                  <span className={`text-[10px] font-semibold tabular-nums w-12 text-right ${dp?(isPos?'profit':'loss'):'text-muted-foreground'}`}>
                    {dp?pct(val):'—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Symbols */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-4">Top Symbols</h2>
          {s.topSyms.length===0?(
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <div className="text-2xl mb-2 opacity-20">📊</div>
              <div className="text-xs">No symbol data yet</div>
            </div>
          ):(
            <div className="space-y-2">
              {s.topSyms.map(([sym,v],i)=>{
                const isPos=v.sum>=0;
                return(
                  <div key={sym} className="flex items-center justify-between rounded-xl px-3 py-2" style={{background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.04)'}}>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground w-4">#{i+1}</span>
                      <span className="text-xs font-semibold">{sym}</span>
                      <span className="text-[9px] text-muted-foreground">{v.n}t</span>
                    </div>
                    <span className={`text-xs font-bold tabular-nums ${isPos?'profit':'loss'}`}>{pct(v.sum)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Trading Calendar */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold">Trading Calendar</h2>
            <p className="text-[10px] text-muted-foreground">Daily P&L heatmap</p>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {now.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['M','T','W','T','F','S','S'].map((d,i)=>(
            <div key={i} className="text-[9px] text-center text-muted-foreground py-1 font-medium">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calCells.map((day,i)=>{
            if(!day) return <div key={i}/>;
            const key=`${yr}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const val=calMap[key];
            const today=day===now.getDate();
            const hasData=val!=null;
            const isPos=hasData&&val>=0;
            return(
              <div key={i} className="aspect-square rounded-lg flex flex-col items-center justify-center transition-all cursor-default hover:scale-105"
                style={{
                  background:hasData?(isPos?`rgba(34,197,94,${Math.min(Math.abs(val)/100,1)*0.4+0.08})`:`rgba(239,68,68,${Math.min(Math.abs(val)/100,1)*0.4+0.08})`):'rgba(255,255,255,0.025)',
                  border:today?'1px solid #6366f1':'1px solid rgba(255,255,255,0.04)',
                  minHeight:36,
                }}>
                <span className="text-[9px] font-medium" style={{color:today?'#818cf8':'hsl(var(--muted-foreground))'}}>{day}</span>
                {hasData&&<span className={`text-[8px] font-bold tabular-nums ${isPos?'text-green-400':'text-red-400'}`}>{isPos?'+':''}{val.toFixed(0)}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Insight + Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)'}}>
              <Sparkles className="w-3.5 h-3.5 text-white"/>
            </div>
            <div>
              <div className="text-sm font-semibold">AI Insights</div>
              <div className="text-[10px] text-muted-foreground">Based on journal</div>
            </div>
          </div>
          <div className="space-y-2">
            {AI_TIPS.map((t,i)=>(
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl" style={{background:'rgba(255,255,255,0.025)',border:'1px solid rgba(255,255,255,0.04)'}}>
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{background:t.col}}/>
                <p className="text-xs leading-relaxed text-muted-foreground">{t.text}</p>
              </div>
            ))}
          </div>
          <Link href="/ai-insights" className="mt-3 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium text-indigo-400" style={{background:'rgba(99,102,241,0.07)',border:'1px solid rgba(99,102,241,0.15)'}}>
            Full Analysis <ChevronRight className="w-3.5 h-3.5"/>
          </Link>
        </div>

        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Recent Trades</h2>
            <Link href="/journal" className="text-xs text-indigo-400 flex items-center gap-1 hover:text-indigo-300">View All <ChevronRight className="w-3.5 h-3.5"/></Link>
          </div>
          {recent.length===0?(
            <div className="py-10 flex flex-col items-center justify-center text-muted-foreground">
              <div className="text-3xl mb-2 opacity-20">📋</div>
              <div className="text-sm">No trades yet</div>
              <Link href="/journal" className="mt-2 text-xs text-indigo-400 hover:underline">Add your first trade →</Link>
            </div>
          ):(
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Date','Instrument','Side','Setup','Entry','Exit','P&L'].map(h=>(
                      <th key={h} className="text-left py-2 px-2 text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t,i)=>{const m=derive(t);const p=m.pnl;return(
                    <tr key={t.id||i} className="trade-row border-b border-white/[0.03]">
                      <td className="py-2.5 px-2 tabular-nums text-muted-foreground">{new Date(t.entryAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</td>
                      <td className="py-2.5 px-2 font-semibold">{t.instrument}</td>
                      <td className="py-2.5 px-2"><span className={t.side==='Buy'?'profit-badge':'loss-badge'}>{t.side}</span></td>
                      <td className="py-2.5 px-2 text-muted-foreground">{setupNames(t.setupId)}</td>
                      <td className="py-2.5 px-2 tabular-nums">{t.entryPrice}</td>
                      <td className="py-2.5 px-2 tabular-nums">{t.exitPrice??'—'}</td>
                      <td className={`py-2.5 px-2 font-bold tabular-nums ${p==null?'text-muted-foreground':p>=0?'profit':'loss'}`}>
                        {p==null?'Open':`${p>=0?'+':''}${p.toFixed(2)}`}
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
