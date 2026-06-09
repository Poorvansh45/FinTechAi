const API_BASE_URL = 'http://localhost:8000/api/v2';

export interface Watchlist {
  id: string;
  name: string;
  created_at: string;
  stock_count: number;
}

export interface WatchlistStock {
  symbol: string;
  company_name: string;
  source_module: string;
  added_date: string;
  added_price: number;
  current_price: number;
  return_pct: number;
  days_held: number;
}

export interface WatchlistDetails {
  watchlist: { id: string; name: str };
  stocks: WatchlistStock[];
  stats: {
    total_stocks: number;
    avg_return_pct: number;
    win_rate_pct: number;
    best_performer: { symbol: string; return: number } | null;
    worst_performer: { symbol: string; return: number } | null;
  };
}

export const watchlistService = {
  getWatchlists: async (): Promise<Watchlist[]> => {
    const res = await fetch(`${API_BASE_URL}/watchlists`);
    if (!res.ok) throw new Error('Failed to fetch watchlists');
    const data = await res.json();
    return data.data;
  },

  createWatchlist: async (name: string): Promise<Watchlist> => {
    const res = await fetch(`${API_BASE_URL}/watchlists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('Failed to create watchlist');
    const data = await res.json();
    return {
      ...data.watchlist,
      id: data.watchlist._id || data.watchlist.id,
      stock_count: 0
    };
  },

  getWatchlistDetails: async (id: string): Promise<WatchlistDetails> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/${id}`);
    if (!res.ok) throw new Error('Failed to fetch watchlist details');
    const data = await res.json();
    return data;
  },

  addStock: async (watchlistId: string, stock: any): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/${watchlistId}/stocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stock)
    });
    if (!res.ok) {
      const err = await res.json();
      let errMsg = err.detail || 'Failed to add stock';
      if (typeof errMsg !== 'string') {
        errMsg = Array.isArray(errMsg) ? errMsg.map((e: any) => e.msg).join(', ') : JSON.stringify(errMsg);
      }
      throw new Error(errMsg);
    }
    return res.json();
  },

  removeStock: async (watchlistId: string, symbol: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/${watchlistId}/stocks/${symbol}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to remove stock');
  },

  getLeaderboard: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/leaderboard`);
    if (!res.ok) throw new Error('Failed to fetch leaderboard');
    const data = await res.json();
    return data.leaderboard;
  },

  getSourcePerformance: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/source-performance`);
    if (!res.ok) throw new Error('Failed to fetch source performance');
    const data = await res.json();
    return data.source_performance;
  },

  renameWatchlist: async (watchlistId: string, name: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/${watchlistId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('Failed to rename watchlist');
  },

  deleteWatchlist: async (watchlistId: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/${watchlistId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete watchlist');
  },

  duplicateWatchlist: async (watchlistId: string): Promise<Watchlist> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/${watchlistId}/duplicate`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to duplicate watchlist');
    const data = await res.json();
    return {
      ...data.watchlist,
      id: data.watchlist._id || data.watchlist.id,
      stock_count: 0
    };
  },

  getPerformanceBySource: async (watchlistId: string): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/watchlists/${watchlistId}/performance`);
    if (!res.ok) throw new Error('Failed to fetch performance');
    const data = await res.json();
    return data.performance_by_source;
  }
};
