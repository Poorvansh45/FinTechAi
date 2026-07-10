import { env } from "@/config/env";

const API_BASE_URL = `${env.fastapiUrl}/api/v2`;

export interface Watchlist {
  id: string;
  name: string;
  created_at: string;
  stock_count: number;
}

export interface WatchlistStock {
  symbol: string;
  company_name?: string;
  source_module?: string;
  added_date?: string;
  added_price?: number;
  current_price?: number;
  return_pct?: number;
  days_held?: number;
  highest_return_pct?: number;
  lowest_return_pct?: number;
  current_drawdown_pct?: number;
  volatility_pct?: number;
  alpha_vs_nifty?: number;
  comparison_returns?: Record<string, number | null>;
}

export interface WatchlistStats {
  total_stocks: number;
  avg_return_pct: number;
  win_rate_pct: number;
  best_performer: { symbol: string; return: number } | null;
  worst_performer: { symbol: string; return: number } | null;
  overall_volatility_pct?: number;
  overall_drawdown_pct?: number;
  overall_alpha_vs_nifty?: number;
}

export interface WatchlistDetails {
  watchlist: { id: string; name: string };
  stocks: WatchlistStock[];
  stats: WatchlistStats;
}

const handleError = async (res: Response, fallback: string) => {
  if (!res.ok) {
    try {
      const err = await res.json();
      let msg = err.detail || fallback;
      if (typeof msg !== "string") {
        msg = Array.isArray(msg) ? msg.map((e: any) => e.msg).join(", ") : JSON.stringify(msg);
      }
      throw new Error(msg);
    } catch {
      throw new Error(fallback);
    }
  }
};

export const watchlistService = {
  getWatchlists: async (): Promise<Watchlist[]> => {
    const res = await fetch(`${API_BASE_URL}/watchlists`);
    await handleError(res, "Failed to fetch watchlists");
    const data = await res.json();
    return data.data;
  },

  createWatchlist: async (name: string): Promise<Watchlist> => {
    const res = await fetch(`${API_BASE_URL}/watchlists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await handleError(res, "Failed to create watchlist");
    const data = await res.json();
    return { ...data.watchlist, id: data.watchlist._id || data.watchlist.id, stock_count: 0 };
  },

  getWatchlistDetails: async (id: string): Promise<WatchlistDetails> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/${id}`);
    await handleError(res, "Failed to fetch watchlist details");
    return res.json();
  },

  addStock: async (watchlistId: string, stock: {
    symbol: string;
    company_name: string;
    source_module: string;
    added_price: number;
    added_rsi?: number | null;
    added_ema50?: number | null;
    added_ema200?: number | null;
    added_volume?: number | null;
  }): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/${watchlistId}/stocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stock),
    });
    await handleError(res, "Failed to add stock");
    return res.json();
  },

  removeStock: async (watchlistId: string, symbol: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/${watchlistId}/stocks/${symbol}`, {
      method: "DELETE",
    });
    await handleError(res, "Failed to remove stock");
  },

  renameWatchlist: async (watchlistId: string, name: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/${watchlistId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await handleError(res, "Failed to rename watchlist");
  },

  deleteWatchlist: async (watchlistId: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/${watchlistId}`, { method: "DELETE" });
    await handleError(res, "Failed to delete watchlist");
  },

  duplicateWatchlist: async (watchlistId: string): Promise<Watchlist> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/${watchlistId}/duplicate`, { method: "POST" });
    await handleError(res, "Failed to duplicate watchlist");
    const data = await res.json();
    return { ...data.watchlist, id: data.watchlist._id || data.watchlist.id, stock_count: 0 };
  },

  getLeaderboard: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/leaderboard`);
    await handleError(res, "Failed to fetch leaderboard");
    const data = await res.json();
    return data.leaderboard;
  },

  getSourcePerformance: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/source-performance`);
    await handleError(res, "Failed to fetch source performance");
    const data = await res.json();
    return data.source_performance;
  },

  getPerformanceBySource: async (watchlistId: string): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/${watchlistId}/performance`);
    await handleError(res, "Failed to fetch performance");
    const data = await res.json();
    return data.performance_by_source;
  },
};
