"""
FinAI Edge — Scanner Cron Job
==============================
Periodically fetches the master universe, downloads bulk history,
calculates TA-Lib indicators, and updates the MongoDB cache.
"""

import asyncio
import logging
from datetime import datetime
from services.groww_universe import universe_service
from services.market_service import get_market_service
from indicators.talib_engine import compute_technical_indicators
from db.models.screener import ScreenerCacheItem, IndicatorData

log = logging.getLogger("finai_edge.scanner_cron")

async def run_scanner_pipeline(db):
    """
    Main execution pipeline for the background cron job.
    """
    log.info("Starting Scanner Background Pipeline...")
    
    # 1. Fetch Universe
    universe = universe_service.fetch_master_universe()
    if not universe:
        log.error("Universe fetch failed or returned empty.")
        return

    # Extract symbols for bulk download (limit to a batch for dev/testing if needed)
    symbols = [item['symbol'] + ".NS" for item in universe] # yfinance requires .NS
    
    # 2. Fetch Bulk Prices
    market_svc = get_market_service()
    log.info(f"Downloading bulk prices for {len(symbols)} stocks...")
    
    # yfinance bulk download returns a DataFrame with symbols as columns
    bulk_df = await market_svc.get_bulk_prices(symbols, period="1y")
    
    if bulk_df.empty:
        log.error("Bulk price download failed.")
        return

    # 3. Calculate Indicators & Upsert to MongoDB
    # bulk_df has a MultiIndex column structure if multiple stocks, or single level if 1
    # We will process each stock individually from the bulk DataFrame
    
    collection = db.get_collection("screener_cache")
    upsert_count = 0

    for item in universe:
        sym = item['symbol']
        yf_sym = sym + ".NS"
        
        try:
            if yf_sym in bulk_df.columns:
                stock_series = bulk_df[yf_sym]
                # Convert series to a single DataFrame for TA-lib engine
                df = stock_series.to_frame(name='close')
                
                # Compute indicators
                df = compute_technical_indicators(df)
                
                # Get latest values
                latest = df.iloc[-1]
                
                indicators = IndicatorData(
                    rsi_14=float(latest.get('RSI_14', 0)) if not pd.isna(latest.get('RSI_14')) else None,
                    ema_20=float(latest.get('EMA_20', 0)) if not pd.isna(latest.get('EMA_20')) else None,
                    ema_50=float(latest.get('EMA_50', 0)) if not pd.isna(latest.get('EMA_50')) else None,
                    macd=float(latest.get('MACD', 0)) if not pd.isna(latest.get('MACD')) else None,
                    macd_signal=float(latest.get('MACD_Signal', 0)) if not pd.isna(latest.get('MACD_Signal')) else None,
                    macd_hist=float(latest.get('MACD_Hist', 0)) if not pd.isna(latest.get('MACD_Hist')) else None,
                )

                cache_item = ScreenerCacheItem(
                    symbol=sym,
                    company_name=item.get('company_name'),
                    price=float(latest.get('close', 0)),
                    indicators=indicators,
                    updated_at=datetime.utcnow()
                )

                # Upsert into MongoDB
                await collection.update_one(
                    {"symbol": sym},
                    {"$set": cache_item.model_dump()},
                    upsert=True
                )
                upsert_count += 1
                
        except Exception as e:
            log.warning(f"Failed to process indicators for {sym}: {e}")

    log.info(f"Scanner Pipeline completed. Upserted {upsert_count} stocks to MongoDB.")

def start_cron(app):
    """
    Optional helper to run this periodically using asyncio.
    """
    async def periodic_task():
        while True:
            if getattr(app.state, "mongo_connected", False) and app.state.db is not None:
                await run_scanner_pipeline(app.state.db)
            # Sleep for 15 minutes (or whatever interval)
            await asyncio.sleep(15 * 60)
            
    asyncio.create_task(periodic_task())
