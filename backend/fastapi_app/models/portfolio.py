"""
FinAI Edge — Portfolio Persistence (MongoDB)
===============================================
Save/load portfolios to MongoDB for user persistence.
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

log = logging.getLogger("finai_edge.models.portfolio")


async def save_portfolio(
    db: AsyncIOMotorDatabase,
    user_id: str,
    name: str,
    holdings: list[dict],
    analysis_snapshot: Optional[dict] = None,
) -> str:
    """
    Save a portfolio to MongoDB.

    Returns:
        Inserted document ID as string.
    """
    doc = {
        "user_id": user_id,
        "name": name,
        "holdings": holdings,
        "analysis_snapshot": analysis_snapshot,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    result = await db.portfolios.insert_one(doc)
    log.info(f"Saved portfolio '{name}' for user {user_id}: {result.inserted_id}")
    return str(result.inserted_id)


async def get_portfolios(
    db: AsyncIOMotorDatabase,
    user_id: str,
    limit: int = 20,
) -> list[dict]:
    """List user's saved portfolios (most recent first)."""
    cursor = (
        db.portfolios
        .find({"user_id": user_id}, {"analysis_snapshot": 0})
        .sort("updated_at", -1)
        .limit(limit)
    )
    portfolios = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        portfolios.append(doc)
    return portfolios


async def get_portfolio_by_id(
    db: AsyncIOMotorDatabase,
    portfolio_id: str,
    user_id: str,
) -> Optional[dict]:
    """Get a specific portfolio by ID."""
    from bson import ObjectId

    try:
        doc = await db.portfolios.find_one({
            "_id": ObjectId(portfolio_id),
            "user_id": user_id,
        })
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc
    except Exception as e:
        log.warning(f"Portfolio lookup failed: {e}")
        return None


async def update_portfolio(
    db: AsyncIOMotorDatabase,
    portfolio_id: str,
    user_id: str,
    holdings: Optional[list[dict]] = None,
    name: Optional[str] = None,
    analysis_snapshot: Optional[dict] = None,
) -> bool:
    """Update an existing portfolio. Returns True if updated."""
    from bson import ObjectId

    update_fields: dict = {"updated_at": datetime.now(timezone.utc)}
    if holdings is not None:
        update_fields["holdings"] = holdings
    if name is not None:
        update_fields["name"] = name
    if analysis_snapshot is not None:
        update_fields["analysis_snapshot"] = analysis_snapshot

    try:
        result = await db.portfolios.update_one(
            {"_id": ObjectId(portfolio_id), "user_id": user_id},
            {"$set": update_fields},
        )
        return result.modified_count > 0
    except Exception as e:
        log.warning(f"Portfolio update failed: {e}")
        return False


async def delete_portfolio(
    db: AsyncIOMotorDatabase,
    portfolio_id: str,
    user_id: str,
) -> bool:
    """Delete a portfolio. Returns True if deleted."""
    from bson import ObjectId

    try:
        result = await db.portfolios.delete_one({
            "_id": ObjectId(portfolio_id),
            "user_id": user_id,
        })
        return result.deleted_count > 0
    except Exception as e:
        log.warning(f"Portfolio delete failed: {e}")
        return False
