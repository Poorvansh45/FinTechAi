import logging
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import get_settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("check_counts")


def main():
    settings = get_settings()
    mongo_uri = settings.mongodb_uri
    db_name = "finai_edge"

    if "mongodb.net/" in mongo_uri:
        parts = mongo_uri.split("mongodb.net/")
        if len(parts) > 1:
            db_part = parts[1].split("?")[0]
            if db_part:
                db_name = db_part

    import certifi
    from pymongo import MongoClient

    client = MongoClient(
        mongo_uri, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where()
    )
    db = client[db_name]

    collections = [
        "screener_cache",
        "fvg_cache",
        "volume_surge_cache",
        "momentum_cache",
        "smc_scanner_results",
        "smc_zones",
        "watchlist_stocks",
    ]

    print("Collection sizes:")
    for col in collections:
        cnt = db[col].count_documents({})
        print(f"  {col}: {cnt}")


if __name__ == "__main__":
    main()
