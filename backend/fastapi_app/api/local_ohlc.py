import os
import re
import io
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, UploadFile, File
import pandas as pd
from datetime import datetime, timezone

from services.local_ohlc_service import (
    get_data_dir,
    process_single_local_file,
    scan_all_local_files
)

router = APIRouter(prefix="/api/v2/scanner/local-ohlc", tags=["Local OHLC Scanner"])
log = logging.getLogger("finai_edge.api.local_ohlc")

def _db(request: Request):
    if not hasattr(request.app.state, "db") or request.app.state.db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return request.app.state.db

def _market(request: Request):
    if not hasattr(request.app.state, "market_service") or request.app.state.market_service is None:
        raise HTTPException(status_code=503, detail="Market service not available")
    return request.app.state.market_service

# Allow only standard chars to prevent file name injection / directory traversal
SAFE_FILENAME_REGEX = re.compile(r"^[a-zA-Z0-9._-]+$")

@router.get("/status")
async def get_local_ohlc_status(request: Request):
    """
    List all local CSV files in backend/data/ and verify their database cache status.
    """
    db = _db(request)
    data_dir = get_data_dir()
    
    files_info = []
    if not os.path.exists(data_dir):
        return {"success": True, "data": []}

    for file_name in os.listdir(data_dir):
        if file_name.lower().endswith(".csv"):
            if file_name.lower() == "stock_data.csv":
                continue
            file_path = os.path.join(data_dir, file_name)
            
            # Boundary check
            resolved_path = os.path.realpath(file_path)
            if os.path.dirname(resolved_path) != os.path.realpath(data_dir):
                continue

            symbol = os.path.splitext(file_name)[0].upper()
            stat = os.stat(resolved_path)
            
            # Check row count
            try:
                df = pd.read_csv(resolved_path)
                row_count = len(df)
            except Exception:
                row_count = 0

            # Query database cache status
            screener_exists = await db.screener_cache.find_one({"symbol": symbol, "is_local": True}) is not None
            fvg_exists = await db.fvg_cache.find_one({"symbol": symbol, "is_local": True}) is not None
            smc_exists = await db.smc_scanner_results.find_one({"symbol": symbol, "is_local": True}) is not None

            files_info.append({
                "filename": file_name,
                "symbol": symbol,
                "size_bytes": stat.st_size,
                "last_modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                "rows": row_count,
                "synced_db": {
                    "screener": screener_exists,
                    "fvg": fvg_exists,
                    "smc": smc_exists
                }
            })

    return {"success": True, "data": files_info}

@router.get("/results")
async def get_local_ohlc_results(request: Request):
    """
    Fetch calculated SMC and FVG results for all local stocks.
    """
    db = _db(request)
    screener_cursor = db.screener_cache.find({"is_local": True})
    fvg_cursor = db.fvg_cache.find({"is_local": True})
    smc_cursor = db.smc_scanner_results.find({"is_local": True})

    screener_docs = await screener_cursor.to_list(length=100)
    fvg_docs = await fvg_cursor.to_list(length=100)
    smc_docs = await smc_cursor.to_list(length=100)

    # Combine results by symbol
    combined = {}
    for doc in screener_docs:
        sym = doc["symbol"]
        combined[sym] = {
            "symbol": sym,
            "price": doc.get("price"),
            "volume": doc.get("volume"),
            "avg_volume_20d": doc.get("avg_volume_20d"),
            "rsi": doc.get("indicators", {}).get("rsi_14"),
            "ema_50_dist_pct": doc.get("indicators", {}).get("ema_50_dist_pct"),
            "ema_200_dist_pct": doc.get("indicators", {}).get("ema_200_dist_pct"),
            "macd_hist": doc.get("indicators", {}).get("macd_hist"),
            "updated_at": doc.get("updated_at")
        }

    for doc in fvg_docs:
        sym = doc["symbol"]
        if sym not in combined:
            combined[sym] = {"symbol": sym}
        combined[sym].update({
            "has_fvg": doc.get("has_fvg_bullish", False),
            "fvg_score": doc.get("best_fvg_score", 0),
            "fvg_status": doc.get("top_bullish_fvgs", [{}])[0].get("status", "N/A") if doc.get("top_bullish_fvgs") else "N/A",
            "fvg_strength": doc.get("top_bullish_fvgs", [{}])[0].get("strength", "N/A") if doc.get("top_bullish_fvgs") else "N/A"
        })

    for doc in smc_docs:
        sym = doc["symbol"]
        if sym not in combined:
            combined[sym] = {"symbol": sym}
        combined[sym].update({
            "smc_score": doc.get("smc_score", 0),
            "structure": doc.get("structure", {}),
            "nearest_demand": doc.get("nearest_demand", {})
        })

    # Clean ObjectIds and format
    from services.smc_service import _serialize
    results_list = [_serialize(v) for v in combined.values()]
    
    return {"success": True, "data": results_list}

@router.post("/trigger")
async def trigger_local_ohlc_scan(request: Request, background_tasks: BackgroundTasks):
    """
    Manually trigger incremental sync and scanner execution for all local files in the background.
    """
    db = _db(request)
    market_svc = _market(request)

    background_tasks.add_task(scan_all_local_files, db, market_svc)
    return {"success": True, "message": "Incremental sync & scan for local OHLC files triggered in the background."}

@router.post("/upload")
async def upload_local_ohlc(request: Request, file: UploadFile = File(...)):
    """
    Securely upload a stock CSV file.
    - Limits size to 5MB.
    - Validates extension (.csv).
    - Prevents path traversal and validates column structure.
    - Runs immediate sync & scan.
    """
    db = _db(request)
    market_svc = _market(request)

    # 1. Validate extension
    filename = file.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed.")

    # 2. Sanitize filename to prevent directory traversal
    base_name = os.path.basename(filename)
    clean_name = re.sub(r'[^a-zA-Z0-9._-]', '', base_name)
    if not clean_name or not SAFE_FILENAME_REGEX.match(clean_name):
        raise HTTPException(status_code=400, detail="Invalid filename format.")

    # 3. Read content with size limit check (max 5MB)
    max_size = 5 * 1024 * 1024  # 5MB
    contents = await file.read(max_size + 1)
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB.")

    # 4. Validate CSV structure
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {e}")

    # Standardize headers case-insensitively for checking
    headers = [h.lower() for h in df.columns]
    required = {'date', 'open', 'high', 'low', 'close'}
    if not required.issubset(headers) and not {'timestamp', 'open', 'high', 'low', 'close'}.issubset(headers):
        raise HTTPException(
            status_code=400,
            detail="CSV must contain required columns: Date (or timestamp), Open, High, Low, and Close."
        )

    # 5. Save securely inside data directory
    data_dir = get_data_dir()
    target_path = os.path.join(data_dir, clean_name)
    
    # Final boundary validation
    resolved_path = os.path.realpath(target_path)
    if os.path.dirname(resolved_path) != os.path.realpath(data_dir):
        raise HTTPException(status_code=400, detail="Invalid upload destination path.")

    with open(resolved_path, "wb") as f:
        f.write(contents)

    # 6. Run Scan Immediately
    scan_res = await process_single_local_file(resolved_path, db, market_svc)
    if not scan_res:
        # Clean up invalid/failed file
        try:
            os.remove(resolved_path)
        except Exception:
            pass
        raise HTTPException(status_code=400, detail="Failed to process stock OHLC candles. Verify data formatting.")

    return {"success": True, "message": f"Successfully uploaded and scanned {clean_name}", "data": scan_res}

@router.delete("/delete/{symbol}")
async def delete_local_ohlc(request: Request, symbol: str):
    """
    Remove a local CSV file and clear its caches from MongoDB.
    """
    db = _db(request)
    symbol_clean = re.sub(r'[^a-zA-Z0-9.-]', '', symbol).upper()
    if not symbol_clean:
        raise HTTPException(status_code=400, detail="Invalid symbol format")

    data_dir = get_data_dir()
    file_name = f"{symbol_clean}.csv"
    file_path = os.path.join(data_dir, file_name)
    
    # Boundary check
    resolved_path = os.path.realpath(file_path)
    if os.path.dirname(resolved_path) != os.path.realpath(data_dir):
        raise HTTPException(status_code=400, detail="Invalid target path")

    deleted = False
    if os.path.exists(resolved_path):
        os.remove(resolved_path)
        deleted = True

    # Clear MongoDB collections
    await db.screener_cache.delete_one({"symbol": symbol_clean, "is_local": True})
    await db.fvg_cache.delete_one({"symbol": symbol_clean, "is_local": True})
    await db.smc_scanner_results.delete_one({"symbol": symbol_clean, "is_local": True})
    await db.smc_zones.delete_many({"symbol": symbol_clean, "is_local": True})

    return {
        "success": True,
        "message": f"Successfully deleted local stock {symbol_clean} and cleared caches.",
        "file_deleted": deleted
    }
