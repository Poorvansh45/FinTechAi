/**
 * useScreenerExport — Export scanner results to CSV
 * Usage: const { exportCSV } = useScreenerExport()
 *        exportCSV(rows, "technical_scan")
 */
export function useScreenerExport() {
  const exportCSV = (rows: any[], filename: string = "scan_results") => {
    if (!rows.length) return;

    // Flatten nested objects for CSV
    const flat = rows.map((r) => {
      const ind = r.indicators ?? {};
      return {
        symbol:             r.symbol           ?? "",
        company:            r.company_name     ?? "",
        ltp:                r.ltp ?? r.price   ?? "",
        volume:             r.volume           ?? "",
        rsi_14:             ind.rsi_14 ?? r.rsi ?? "",
        ema_50_dist_pct:    ind.ema_50_dist_pct  ?? r.ema_50_dist_pct  ?? "",
        ema_200_dist_pct:   ind.ema_200_dist_pct ?? r.ema_200_dist_pct ?? "",
        macd:               ind.macd            ?? "",
        macd_hist:          ind.macd_hist       ?? "",
        momentum_score:     r.momentum_score    ?? "",
        momentum_category:  r.category          ?? "",
        best_fvg_score:     r.best_fvg_score    ?? "",
        volume_ratio:       r.current_volume_ratio ?? r.volume_ratio ?? "",
        smc_score:          r.smc_score         ?? "",
        smc_event:          r.structure?.last_bullish_event ?? "",
        current_zone:       r.current_zone      ?? "",
        distance_pct:       r.nearest_demand?.distance_pct ?? r.distance_pct ?? "",
      };
    });

    const headers = Object.keys(flat[0]);
    const csvRows = [
      headers.join(","),
      ...flat.map((row) =>
        headers.map((h) => {
          const v = (row as any)[h];
          const s = v == null ? "" : String(v);
          return s.includes(",") ? `"${s}"` : s;
        }).join(",")
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return { exportCSV };
}

/**
 * useSavedFilters — Persist screener filter presets to localStorage
 */
export interface FilterPreset {
  name:      string;
  scanner:   string;
  filters:   Record<string, any>;
  createdAt: string;
}

const STORAGE_KEY = "finai_screener_presets";

export function useSavedFilters(scanner: string) {
  const getAll = (): FilterPreset[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return (JSON.parse(raw) as FilterPreset[]).filter((p) => p.scanner === scanner);
    } catch { return []; }
  };

  const savePreset = (name: string, filters: Record<string, any>) => {
    try {
      const raw  = localStorage.getItem(STORAGE_KEY);
      const all: FilterPreset[] = raw ? JSON.parse(raw) : [];
      // Replace if name already exists for this scanner
      const filtered = all.filter((p) => !(p.scanner === scanner && p.name === name));
      filtered.push({ name, scanner, filters, createdAt: new Date().toISOString() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch {}
  };

  const deletePreset = (name: string) => {
    try {
      const raw  = localStorage.getItem(STORAGE_KEY);
      const all: FilterPreset[] = raw ? JSON.parse(raw) : [];
      const next = all.filter((p) => !(p.scanner === scanner && p.name === name));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  return { getAll, savePreset, deletePreset };
}
