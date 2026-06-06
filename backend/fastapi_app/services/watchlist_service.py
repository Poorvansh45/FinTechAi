import logging
from datetime import datetime
from typing import List, Dict, Any
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import HTTPException

from db.models.watchlist import (
    WatchlistCreate, WatchlistInDB,
    WatchlistStockCreate, WatchlistStockInDB,
    WatchlistHistoryInDB
)
from services.market_service import get_market_service

log = logging.getLogger("finai_edge.watchlist_service")

class WatchlistService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.market_svc = get_market_service()
        self.watchlists_coll = self.db.watchlists
        self.stocks_coll = self.db.watchlist_stocks
        self.history_coll = self.db.watchlist_history

    async def _setup_indexes(self):
        """Ensure indexes exist for scalability."""
        await self.watchlists_coll.create_index("created_by")
        # Unique compound index to prevent duplicate stocks in same watchlist
        await self.stocks_coll.create_index(
            [("watchlist_id", 1), ("symbol", 1)],
            unique=True
        )
        await self.stocks_coll.create_index("source_module")
        await self.history_coll.create_index("watchlist_id")

    async def create_watchlist(self, data: WatchlistCreate, user_id: str = "default_user") -> WatchlistInDB:
        doc = {
            "name": data.name,
            "created_at": datetime.utcnow(),
            "created_by": user_id,
            "updated_at": datetime.utcnow()
        }
        res = await self.watchlists_coll.insert_one(doc)
        doc["_id"] = res.inserted_id
        return WatchlistInDB(**doc)

    async def get_user_watchlists(self, user_id: str = "default_user") -> List[Dict[str, Any]]:
        cursor = self.watchlists_coll.find({"created_by": user_id}).sort("created_at", -1)
        watchlists = []
        async for wl in cursor:
            # Get stock count
            count = await self.stocks_coll.count_documents({"watchlist_id": wl["_id"]})
            wl_obj = WatchlistInDB(**wl)
            watchlists.append({
                "id": str(wl_obj.id),
                "name": wl_obj.name,
                "created_at": wl_obj.created_at,
                "stock_count": count
            })
        return watchlists

    async def rename_watchlist(self, watchlist_id: str, new_name: str) -> None:
        try:
            wl_id = ObjectId(watchlist_id)
        except:
            raise HTTPException(400, "Invalid watchlist ID")
            
        res = await self.watchlists_coll.update_one(
            {"_id": wl_id},
            {"$set": {"name": new_name, "updated_at": datetime.utcnow()}}
        )
        if res.matched_count == 0:
            raise HTTPException(404, "Watchlist not found")

    async def archive_watchlist(self, watchlist_id: str) -> None:
        try:
            wl_id = ObjectId(watchlist_id)
        except:
            raise HTTPException(400, "Invalid watchlist ID")
            
        res = await self.watchlists_coll.update_one(
            {"_id": wl_id},
            {"$set": {"is_archived": True, "updated_at": datetime.utcnow()}}
        )
        if res.matched_count == 0:
            raise HTTPException(404, "Watchlist not found")

    async def delete_watchlist(self, watchlist_id: str) -> None:
        try:
            wl_id = ObjectId(watchlist_id)
        except:
            raise HTTPException(400, "Invalid watchlist ID")
        
        wl = await self.watchlists_coll.find_one({"_id": wl_id})
        if not wl:
            raise HTTPException(404, "Watchlist not found")
            
        # Move all stocks to history
        stocks_cursor = self.stocks_coll.find({"watchlist_id": wl_id})
        async for stock_doc in stocks_cursor:
            symbol = stock_doc["symbol"]
            quote = await self.market_svc.get_quote(symbol)
            final_price = quote.price if quote.available and quote.price else stock_doc.get("added_price", 0)
            
            added_price = stock_doc.get("added_price", 0)
            if added_price > 0:
                final_return = ((final_price - added_price) / added_price) * 100
            else:
                final_return = 0.0

            added_date = stock_doc.get("added_date", datetime.utcnow())
            removed_date = datetime.utcnow()
            holding_days = max(1, (removed_date - added_date).days)

            history_doc = {
                "watchlist_id": wl_id,
                "symbol": symbol,
                "added_date": added_date,
                "removed_date": removed_date,
                "holding_period_days": holding_days,
                "final_return_pct": final_return
            }
            await self.history_coll.insert_one(history_doc)
            
        # Delete stocks and watchlist
        await self.stocks_coll.delete_many({"watchlist_id": wl_id})
        await self.watchlists_coll.delete_one({"_id": wl_id})

    async def duplicate_watchlist(self, watchlist_id: str) -> WatchlistInDB:
        try:
            wl_id = ObjectId(watchlist_id)
        except:
            raise HTTPException(400, "Invalid watchlist ID")
            
        wl = await self.watchlists_coll.find_one({"_id": wl_id})
        if not wl:
            raise HTTPException(404, "Watchlist not found")
            
        new_doc = {
            "name": f"{wl['name']} (Copy)",
            "created_at": datetime.utcnow(),
            "created_by": wl["created_by"],
            "updated_at": datetime.utcnow(),
            "is_archived": False
        }
        res = await self.watchlists_coll.insert_one(new_doc)
        new_wl_id = res.inserted_id
        
        # Duplicate stocks
        stocks_cursor = self.stocks_coll.find({"watchlist_id": wl_id})
        async for stock in stocks_cursor:
            del stock["_id"]
            stock["watchlist_id"] = new_wl_id
            stock["added_date"] = datetime.utcnow()
            await self.stocks_coll.insert_one(stock)
            
        new_doc["_id"] = new_wl_id
        return WatchlistInDB(**new_doc)

    async def add_stock(self, watchlist_id: str, data: WatchlistStockCreate) -> WatchlistStockInDB:
        try:
            wl_id = ObjectId(watchlist_id)
        except:
            raise HTTPException(400, "Invalid watchlist ID")
            
        wl = await self.watchlists_coll.find_one({"_id": wl_id})
        if not wl:
            raise HTTPException(404, "Watchlist not found")

        doc = data.dict()
        doc["watchlist_id"] = wl_id
        doc["added_date"] = datetime.utcnow()

        existing = await self.stocks_coll.find_one({"watchlist_id": wl_id, "symbol": data.symbol})
        if existing:
            raise HTTPException(400, f"Stock {data.symbol} is already in this watchlist")

        try:
            res = await self.stocks_coll.insert_one(doc)
            doc["_id"] = res.inserted_id
            return WatchlistStockInDB(**doc)
        except Exception as e:
            if "duplicate key error" in str(e).lower():
                raise HTTPException(400, f"Stock {data.symbol} is already in this watchlist")
            raise HTTPException(500, "Failed to add stock")

    async def remove_stock(self, watchlist_id: str, symbol: str) -> None:
        try:
            wl_id = ObjectId(watchlist_id)
        except:
            raise HTTPException(400, "Invalid watchlist ID")

        stock_doc = await self.stocks_coll.find_one({"watchlist_id": wl_id, "symbol": symbol})
        if not stock_doc:
            raise HTTPException(404, "Stock not found in watchlist")

        # Get current price to calculate final return
        quote = await self.market_svc.get_quote(symbol)
        final_price = quote.price if quote.available and quote.price else stock_doc.get("added_price", 0)
        
        added_price = stock_doc.get("added_price", 0)
        if added_price > 0:
            final_return = ((final_price - added_price) / added_price) * 100
        else:
            final_return = 0.0

        added_date = stock_doc.get("added_date", datetime.utcnow())
        removed_date = datetime.utcnow()
        holding_days = max(1, (removed_date - added_date).days)

        history_doc = {
            "watchlist_id": wl_id,
            "symbol": symbol,
            "added_date": added_date,
            "removed_date": removed_date,
            "holding_period_days": holding_days,
            "final_return_pct": final_return
        }
        await self.history_coll.insert_one(history_doc)
        await self.stocks_coll.delete_one({"_id": stock_doc["_id"]})

    async def get_watchlist_details(self, watchlist_id: str) -> Dict[str, Any]:
        try:
            wl_id = ObjectId(watchlist_id)
        except:
            raise HTTPException(400, "Invalid watchlist ID")

        wl = await self.watchlists_coll.find_one({"_id": wl_id})
        if not wl:
            raise HTTPException(404, "Watchlist not found")

        stocks_cursor = self.stocks_coll.find({"watchlist_id": wl_id})
        stocks = [WatchlistStockInDB(**s) async for s in stocks_cursor]

        # Fetch bulk quotes and historical prices including Nifty 50 benchmark
        symbols = [s.symbol for s in stocks]
        quotes = await self.market_svc.get_bulk_quotes(symbols + ["^NSEI"])
        historical_prices = await self.market_svc.get_bulk_prices(symbols + ["^NSEI"], period="1y")

        enriched_stocks = []
        total_return = 0.0
        win_count = 0
        best_performer = {"symbol": None, "return": -999999.0}
        worst_performer = {"symbol": None, "return": 999999.0}

        # For overall drawdown and volatility approximations
        watchlist_daily_returns = []

        now = datetime.utcnow()

        for s in stocks:
            quote = quotes.get(s.symbol)
            current_price = quote.price if quote and quote.available and quote.price else s.added_price
            
            ret_pct = 0.0
            if s.added_price > 0:
                ret_pct = ((current_price - s.added_price) / s.added_price) * 100
            
            days_held = max(1, (now - s.added_date).days)
            
            highest_ret = ret_pct
            lowest_ret = ret_pct
            drawdown = 0.0
            volatility = 0.0
            comp_returns = {"1D": None, "5D": None, "10D": None, "30D": None, "90D": None}
            alpha_vs_nifty = 0.0

            # Calculate analytics if historical data is available
            if not historical_prices.empty and s.symbol in historical_prices.columns:
                stock_prices = historical_prices[s.symbol].dropna()
                # Filter for prices after added_date
                post_add_prices = stock_prices[stock_prices.index.tz_localize(None) >= s.added_date]
                
                # Also calculate Nifty 50 performance over the exact same period
                nifty_ret = 0.0
                if "^NSEI" in historical_prices.columns:
                    nifty_prices = historical_prices["^NSEI"].dropna()
                    nifty_post_add = nifty_prices[nifty_prices.index.tz_localize(None) >= s.added_date]
                    if not nifty_post_add.empty:
                        nifty_start = nifty_post_add.iloc[0]
                        nifty_current = nifty_prices.iloc[-1]
                        nifty_ret = ((nifty_current - nifty_start) / nifty_start) * 100
                
                alpha_vs_nifty = ret_pct - nifty_ret

                if not post_add_prices.empty and s.added_price > 0:
                    max_price = post_add_prices.max()
                    min_price = post_add_prices.min()
                    highest_ret = ((max_price - s.added_price) / s.added_price) * 100
                    lowest_ret = ((min_price - s.added_price) / s.added_price) * 100
                    
                    # Drawdown from peak since added
                    current_from_peak = ((current_price - max_price) / max_price) * 100 if max_price > 0 else 0
                    drawdown = current_from_peak
                    
                    # Volatility
                    daily_returns = post_add_prices.pct_change().dropna()
                    if len(daily_returns) > 1:
                        volatility = daily_returns.std() * (252 ** 0.5) * 100
                        
                    # Comparison returns from added_date
                    for days, label in [(1, "1D"), (5, "5D"), (10, "10D"), (30, "30D"), (90, "90D")]:
                        if len(post_add_prices) > days:
                            # Use price exactly `days` trading days after addition
                            target_price = post_add_prices.iloc[days]
                            comp_returns[label] = ((target_price - s.added_price) / s.added_price) * 100

            # Stats updates
            total_return += ret_pct
            if ret_pct > 0:
                win_count += 1
            if ret_pct > best_performer["return"]:
                best_performer = {"symbol": s.symbol, "return": ret_pct}
            if ret_pct < worst_performer["return"]:
                worst_performer = {"symbol": s.symbol, "return": ret_pct}

            enriched_stocks.append({
                "symbol": s.symbol,
                "company_name": s.company_name,
                "source_module": s.source_module,
                "added_date": s.added_date,
                "added_price": s.added_price,
                "current_price": current_price,
                "return_pct": ret_pct,
                "days_held": days_held,
                "highest_return_pct": highest_ret,
                "lowest_return_pct": lowest_ret,
                "current_drawdown_pct": drawdown,
                "volatility_pct": volatility,
                "comparison_returns": comp_returns,
                "alpha_vs_nifty": alpha_vs_nifty
            })

        total_stocks = len(stocks)
        avg_ret = total_return / total_stocks if total_stocks > 0 else 0.0
        
        # Calculate overall watchlist drawdown and volatility from average of components for simplicity
        overall_volatility = sum(s["volatility_pct"] for s in enriched_stocks) / total_stocks if total_stocks > 0 else 0.0
        overall_drawdown = sum(s["current_drawdown_pct"] for s in enriched_stocks) / total_stocks if total_stocks > 0 else 0.0
        overall_alpha = sum(s["alpha_vs_nifty"] for s in enriched_stocks) / total_stocks if total_stocks > 0 else 0.0

        stats = {
            "total_stocks": total_stocks,
            "avg_return_pct": avg_ret,
            "win_rate_pct": (win_count / total_stocks * 100) if total_stocks > 0 else 0.0,
            "best_performer": best_performer if total_stocks > 0 else None,
            "worst_performer": worst_performer if total_stocks > 0 else None,
            "overall_volatility_pct": overall_volatility,
            "overall_drawdown_pct": overall_drawdown,
            "overall_alpha_vs_nifty": overall_alpha
        }

        return {
            "watchlist": {"id": str(wl["_id"]), "name": wl["name"]},
            "stocks": enriched_stocks,
            "stats": stats
        }

    async def get_watchlist_performance_by_source(self, watchlist_id: str) -> Dict[str, Any]:
        details = await self.get_watchlist_details(watchlist_id)
        stocks = details.get("stocks", [])
        
        sources = {}
        for s in stocks:
            src = s["source_module"]
            if src not in sources:
                sources[src] = {"total_return": 0.0, "count": 0}
            sources[src]["total_return"] += s["return_pct"]
            sources[src]["count"] += 1
            
        perf = {}
        for src, data in sources.items():
            perf[src] = {
                "avg_return_pct": data["total_return"] / data["count"],
                "count": data["count"]
            }
            
        return {"performance_by_source": perf}
    async def get_watchlist_leaderboard(self) -> List[Dict[str, Any]]:
        # For leaderboard, we'll fetch details of all non-archived watchlists
        cursor = self.watchlists_coll.find({"is_archived": {"$ne": True}})
        leaderboard = []
        async for wl in cursor:
            details = await self.get_watchlist_details(str(wl["_id"]))
            stats = details.get("stats", {})
            if stats.get("total_stocks", 0) > 0:
                avg_ret = stats.get("avg_return_pct", 0)
                volatility = stats.get("overall_volatility_pct", 0)
                # Proxy for risk-free rate: 7%
                risk_free_rate = 7.0
                risk_adj = (avg_ret - risk_free_rate) / volatility if volatility > 0 else 0
                
                leaderboard.append({
                    "id": str(wl["_id"]),
                    "name": wl["name"],
                    "avg_return_pct": avg_ret,
                    "win_rate_pct": stats.get("win_rate_pct", 0),
                    "risk_adjusted_return": risk_adj,
                    "overall_volatility": volatility,
                    "total_stocks": stats.get("total_stocks", 0)
                })
        
        # Sort by average return descending
        leaderboard.sort(key=lambda x: x["avg_return_pct"], reverse=True)
        return leaderboard

    async def get_source_performance(self) -> List[Dict[str, Any]]:
        # Compute across all watchlists and history
        sources = {}
        

            
        # As a fallback for the UI to work immediately: We aggregate over get_user_watchlists active stocks
        watchlists = await self.get_user_watchlists()
        for wl in watchlists:
            perf = await self.get_watchlist_performance_by_source(wl["id"])
            for src, data in perf.get("performance_by_source", {}).items():
                if src not in sources:
                    sources[src] = {"total_return": 0.0, "count": 0}
                sources[src]["total_return"] += data["avg_return_pct"] * data["count"]
                sources[src]["count"] += data["count"]

        result = []
        for src, data in sources.items():
            if data["count"] > 0:
                result.append({
                    "source_module": src,
                    "avg_return_pct": data["total_return"] / data["count"],
                    "total_stocks": data["count"]
                })
        
        result.sort(key=lambda x: x["avg_return_pct"], reverse=True)
        return result
def get_watchlist_service(db: AsyncIOMotorDatabase) -> WatchlistService:
    return WatchlistService(db)
