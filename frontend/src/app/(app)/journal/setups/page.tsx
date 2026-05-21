"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SetupForm } from "@/components/journal/SetupForm";
import { listSetups, createSetup, deleteSetup, updateSetup } from "@/lib/journal/storage";
import type { Setup } from "@/lib/journal/types";
import { Plus, Trash2, Pencil, Search } from "lucide-react";

export default function MySetupsPage() {
  const [setups, setSetups] = useState<Setup[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [marketFilter, setMarketFilter] = useState<string>("");

  const refresh = () => setSetups(listSetups());
  useEffect(() => { refresh(); }, []);

  const filtered = setups.filter(s => {
    const okMarket = !marketFilter || s.marketType === marketFilter;
    const text = q.toLowerCase();
    const okText = !text || s.name.toLowerCase().includes(text) || (s.tags||[]).some(t=>t.toLowerCase().includes(text));
    return okMarket && okText;
  });

  return (
    <div className="container px-4 md:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Setups</h1>
        <Button onClick={() => setAdding(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add New Setup
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search by name or tag" className="w-full h-9 rounded-md border bg-background pl-8 pr-3 text-sm" />
          </div>
        </div>
        <div>
          <select value={marketFilter} onChange={(e)=>setMarketFilter(e.target.value)} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
            <option value="">All Markets</option>
            <option>Indices</option>
            <option>Stocks</option>
            <option>FNO</option>
            <option>Forex</option>
          </select>
        </div>
      </div>

      {adding && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Create a New Setup</CardTitle>
          </CardHeader>
          <CardContent>
            <SetupForm
              onSubmit={(data) => {
                createSetup(data);
                setAdding(false);
                refresh();
              }}
              onCancel={() => setAdding(false)}
            />
          </CardContent>
        </Card>
      )}

      {editingId && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Edit Setup</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const s = setups.find(x=>x.id===editingId);
              if (!s) return null;
              return (
                <SetupForm
                  initial={s}
                  onSubmit={(data)=>{
                    updateSetup(s.id, { ...s, ...data });
                    setEditingId(null);
                    refresh();
                  }}
                  onCancel={()=> setEditingId(null)}
                />
              );
            })()}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Saved Setups</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground">No setups saved yet. Click "Add New Setup" to create one.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((s) => (
                <div key={s.id} className="rounded-md border p-4 bg-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.marketType}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditingId(s.id)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm('Delete this setup and its trades?')) { deleteSetup(s.id); refresh(); } }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {s.tags && s.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {s.tags.map((t, i) => (
                        <Badge key={i} variant="secondary">{t}</Badge>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{s.params?.entryCriteria || s.params?.notes || ''}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
