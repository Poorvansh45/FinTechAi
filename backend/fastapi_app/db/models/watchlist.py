from datetime import datetime

from bson import ObjectId
from pydantic import BaseModel, Field


class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, handler):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema, handler):
        return {"type": "string"}


class WatchlistBase(BaseModel):
    name: str
    description: str | None = None
    is_archived: bool = False


class WatchlistCreate(WatchlistBase):
    pass


class WatchlistInDB(WatchlistBase):
    id: PyObjectId | None = Field(alias="_id", default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str = "default_user"  # Placeholder until full auth is available
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class WatchlistStockBase(BaseModel):
    symbol: str
    company_name: str
    source_module: str
    added_price: float
    added_volume: float | None = None
    added_rsi: float | None = None
    added_ema50: float | None = None
    added_ema200: float | None = None


class WatchlistStockCreate(WatchlistStockBase):
    pass


class WatchlistStockInDB(WatchlistStockBase):
    id: PyObjectId | None = Field(alias="_id", default=None)
    watchlist_id: PyObjectId
    added_date: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class WatchlistHistoryInDB(BaseModel):
    id: PyObjectId | None = Field(alias="_id", default=None)
    watchlist_id: PyObjectId
    symbol: str
    added_date: datetime
    removed_date: datetime = Field(default_factory=datetime.utcnow)
    holding_period_days: int
    final_return_pct: float

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class WatchlistSnapshotInDB(BaseModel):
    id: PyObjectId | None = Field(alias="_id", default=None)
    watchlist_id: PyObjectId
    snapshot_date: datetime = Field(default_factory=datetime.utcnow)
    total_stocks: int
    avg_return_pct: float
    win_rate_pct: float
    total_value_proxy: float

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class WatchlistAnalyticsInDB(BaseModel):
    id: PyObjectId | None = Field(alias="_id", default=None)
    watchlist_id: PyObjectId
    last_computed: datetime = Field(default_factory=datetime.utcnow)
    alpha_vs_nifty50: float = 0.0
    volatility_pct: float = 0.0
    risk_adjusted_return: float = 0.0
    current_drawdown_pct: float = 0.0
    best_source: str | None = None
    worst_source: str | None = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}
