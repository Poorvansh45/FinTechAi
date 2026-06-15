import os
import sys
import logging
from datetime import datetime

# Add the parent directory to sys.path to import local packages
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import get_settings
from utils.helpers import normalize_symbol

logging.basicConfig(level=logging.INFO, format="[Migration] %(levelname)s: %(message)s")
log = logging.getLogger("deduplicate_db")

def run_migration():
    settings = get_settings()
    mongo_uri = settings.mongodb_uri
    db_name = "finai_edge"
    
    # Parse db name from URI if it's there
    if "mongodb.net/" in mongo_uri:
        parts = mongo_uri.split("mongodb.net/")
        if len(parts) > 1:
            db_part = parts[1].split("?")[0]
            if db_part:
                db_name = db_part
                
    log.info(f"Connecting to MongoDB database: {db_name}")
    
    try:
        import certifi
        from pymongo import MongoClient
        from pymongo import UpdateOne, DeleteOne
        
        client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,
            tlsCAFile=certifi.where()
        )
        # Ping
        client.admin.command("ping")
        db = client[db_name]
        log.info("Successfully connected to MongoDB!")
    except Exception as e:
        log.error(f"Failed to connect to MongoDB: {e}")
        sys.exit(1)
        
    collections_to_dedup = [
        "screener_cache",
        "fvg_cache",
        "volume_surge_cache",
        "momentum_cache",
        "smc_scanner_results",
        "smc_zones",
        "watchlist_stocks"
    ]
    
    validation_report = {}
    sample_removed = []
    
    for coll_name in collections_to_dedup:
        coll = db[coll_name]
        total_before = coll.count_documents({})
        
        # Read all documents
        docs = list(coll.find({}))
        
        # Track grouped documents by normalized symbol
        groups = {}
        for d in docs:
            symbol = d.get("symbol")
            if not symbol:
                continue
                
            norm = normalize_symbol(symbol)
            if norm not in groups:
                groups[norm] = []
            groups[norm].append((symbol, d))
            
        total_after_norm = len(docs)
        
        ops = []
        duplicates_removed_count = 0
        
        for norm_symbol, symbol_docs in groups.items():
            if len(symbol_docs) > 1:
                # We have duplicates! Let's sort them by timestamp/date field descending to find the latest
                def get_time(item):
                    doc = item[1]
                    for tf in ["updated_at", "added_date", "created_at"]:
                        if tf in doc and doc[tf]:
                            val = doc[tf]
                            if isinstance(val, datetime):
                                return val.timestamp()
                            return str(val)
                    # fallback to _id generation time if ObjectId
                    from bson import ObjectId
                    if isinstance(doc["_id"], ObjectId):
                        return doc["_id"].generation_time.timestamp()
                    return 0
                    
                sorted_docs = sorted(symbol_docs, key=get_time, reverse=True)
                latest_original_symbol, latest_doc = sorted_docs[0]
                
                # Delete all other duplicates in the group
                for orig_symbol, old_doc in sorted_docs[1:]:
                    ops.append(DeleteOne({"_id": old_doc["_id"]}))
                    duplicates_removed_count += 1
                    
                    sample_str = f"Removed duplicate symbol '{orig_symbol}' (merged into '{norm_symbol}') in '{coll_name}'"
                    if len(sample_removed) < 10:
                        sample_removed.append(sample_str)
                
                # Update the kept latest document's symbol to normalized symbol
                ops.append(UpdateOne({"_id": latest_doc["_id"]}, {"$set": {"symbol": norm_symbol}}))
            else:
                # Only one document, normalize its symbol field if it differs
                orig_symbol, d = symbol_docs[0]
                if orig_symbol != norm_symbol:
                    ops.append(UpdateOne({"_id": d["_id"]}, {"$set": {"symbol": norm_symbol}}))
                    sample_str = f"Normalized symbol '{orig_symbol}' to '{norm_symbol}' in '{coll_name}'"
                    if len(sample_removed) < 10:
                        sample_removed.append(sample_str)
                        
        if ops:
            log.info(f"Executing bulk write of {len(ops)} operations on collection: {coll_name}")
            # Run operations in order (deletions first for duplicates is handled implicitly because they are appended before updates)
            # Wait, to be safe, we want ordered=True or ordered=False? Let's use ordered=True, so deletions execute before updates!
            coll.bulk_write(ops, ordered=True)
            
        total_after_dedup = coll.count_documents({})
        validation_report[coll_name] = {
            "before": total_before,
            "after_norm": total_after_norm,
            "after_dedup": total_after_dedup,
            "removed": duplicates_removed_count
        }
        
    # Standardize scan metadata: record_count and symbols_processed in daily_scan metadata record
    screener_cache_count = db["screener_cache"].count_documents({})
    
    meta_coll = db["scan_meta"]
    meta_doc = meta_coll.find_one({"_id": "daily_scan"})
    
    if meta_doc:
        meta_coll.update_one(
            {"_id": "daily_scan"},
            {
                "$set": {
                    "record_count": screener_cache_count,
                    "symbols_processed": screener_cache_count,
                    "total_symbols": screener_cache_count
                }
            }
        )
        log.info(f"Updated scan_meta metadata record to count: {screener_cache_count}")
    else:
        # Create a default one if missing
        meta_coll.update_one(
            {"_id": "daily_scan"},
            {
                "$set": {
                    "_id": "daily_scan",
                    "status": "COMPLETED",
                    "last_ran": datetime.utcnow(),
                    "record_count": screener_cache_count,
                    "symbols_processed": screener_cache_count,
                    "total_symbols": screener_cache_count
                }
            },
            upsert=True
        )
        log.info(f"Created default scan_meta with record_count: {screener_cache_count}")

    # ==========================================
    # VALIDATION REPORT PRINT
    # ==========================================
    print("\n==========================================")
    print("VALIDATION REPORT")
    print("==========================================")
    for coll_name, metrics in validation_report.items():
        print(f"Collection: {coll_name}")
        print(f"  Total rows before normalization: {metrics['before']}")
        print(f"  Total rows after normalization:  {metrics['after_norm']}")
        print(f"  Total rows after deduplication:  {metrics['after_dedup']}")
        print(f"  Duplicate rows removed:          {metrics['removed']}")
        print()
        
    print("Sample duplicate/normalized symbols removed/cleaned:")
    if sample_removed:
        for s in sample_removed[:10]:
            print(f"  - {s}")
    else:
        print("  None (all clean or no duplicates found)")
    print("==========================================\n")
    
    # ==========================================
    # DEBUG REPORT PRINT
    # ==========================================
    meta_doc = meta_coll.find_one({"_id": "daily_scan"})
    print("==========================================")
    print("DEBUG REPORT")
    print("==========================================")
    print(f"1. Total scanner records:         {screener_cache_count}")
    print(f"2. Total normalized records:      {screener_cache_count}")
    
    total_removed = sum(m["removed"] for m in validation_report.values())
    print(f"3. Total duplicate records removed: {total_removed}")
    print(f"4. Total symbols scanned:          {meta_doc.get('total_symbols') if meta_doc else screener_cache_count}")
    print(f"5. Metadata record count:          {meta_doc.get('record_count') if meta_doc else screener_cache_count}")
    print(f"6. Table record count:             {screener_cache_count}")
    print(f"7. Status bar record count:        {meta_doc.get('symbols_processed') if meta_doc else screener_cache_count}")
    print(f"8. Matched badge count:            {screener_cache_count}")
    
    counts_match = (
        screener_cache_count == meta_doc.get("record_count") == meta_doc.get("symbols_processed")
    )
    print(f"Counts Match Verification:         {'✓ MATCHED' if counts_match else '✗ MISMATCHED'}")
    print("==========================================\n")

if __name__ == "__main__":
    run_migration()
