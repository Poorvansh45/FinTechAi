"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Types are flexible because CSV headers can vary; we render dynamic keys
type Row = Record<string, any>;

export default function ScreenerPage() {
  // Default conditions per your request
  const [cmpMin, setCmpMin] = useState<string>("200");
  const [cmpMax, setCmpMax] = useState<string>("5000");
  const [chgMin, setChgMin] = useState<string>("-5");
  const [chgMax, setChgMax] = useState<string>("10");
  const [demand, setDemand] = useState<"hot" | "zone" | "both" | "any">("hot");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ cmpMin, cmpMax, chgMin, chgMax, demand, limit: "200" });
      const res = await fetch(`/api/screener?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "API error");
      setRows(Array.isArray(json.rows) ? json.rows : []);
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const serialColNameMatcher = (k: string) => /^(s(erial)?\s*\.?\s*(no|number)|sno)$/i.test(k.replace(/_/g, ' '));

  const sortedRows = useMemo(() => {
    if (!rows.length) return rows;
    // If a serial-number like column exists, sort ascending numerically
    const keys = Object.keys(rows[0] || {});
    const serialKey = keys.find((k) => serialColNameMatcher(k));
    if (!serialKey) return rows;
    const safeNum = (v: any) => {
      const n = Number(String(v).replace(/[^0-9.-]/g, ''));
      return isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
    };
    return [...rows].sort((a, b) => safeNum(a[serialKey]) - safeNum(b[serialKey]));
  }, [rows]);

  const columns = useMemo(() => {
    if (!sortedRows.length) return [] as string[];
    // Use the union of keys of the first few rows
    const keys = new Set<string>();
    sortedRows.slice(0, 5).forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));
    // Prefer commonly useful columns first
    const preferred = ["symbol", "name", "sector", "cmp", "CMP", "price", "change_pct", "Change %", "%change"];
    const ordered: string[] = [];
    preferred.forEach((p) => { if (keys.has(p)) { ordered.push(p); keys.delete(p); } });
    ordered.push(...Array.from(keys));
    return ordered;
  }, [sortedRows]);

  return (
    <div className="container px-4 md:px-6 py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CSV Screener</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">CMP Min</label>
            <Input value={cmpMin} onChange={(e) => setCmpMin(e.target.value)} type="number" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">CMP Max</label>
            <Input value={cmpMax} onChange={(e) => setCmpMax(e.target.value)} type="number" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Change % Min</label>
            <Input value={chgMin} onChange={(e) => setChgMin(e.target.value)} type="number" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Change % Max</label>
            <Input value={chgMax} onChange={(e) => setChgMax(e.target.value)} type="number" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="text-xs text-muted-foreground">Demand Zone</label>
            <Select value={demand} onValueChange={(v: any) => setDemand(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Demand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hot">HOT Demand Zone</SelectItem>
                <SelectItem value="zone">Demand Zone</SelectItem>
                <SelectItem value="both">Both</SelectItem>
                <SelectItem value="any">Any</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 md:col-span-1 flex items-end">
            <Button onClick={fetchData} disabled={loading} className="w-full">{loading ? "Filtering..." : "Apply"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          {error ? (
            <div className="text-sm text-red-500">{error}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  {columns.map((c) => (
                    <TableHead key={c}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{idx + 1}</TableCell>
                    {columns.map((c) => (
                      <TableCell key={c}>{String(r[c] ?? "")}</TableCell>
                    ))}
                  </TableRow>
                ))}
                {!sortedRows.length && (
                  <TableRow>
                    <TableCell colSpan={(columns.length || 1) + 1} className="text-center text-muted-foreground">
                      {loading ? "Loading..." : "No rows found for the current filters."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
