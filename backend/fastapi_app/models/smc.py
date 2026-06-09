from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class SMCZone(BaseModel):
    symbol: str
    zone_id: int
    created_date: datetime
    event: str  # "BOS" or "CHoCH"
    zone_high: float
    zone_low: float
    status: str = "Active"  # Active, Done, Invalidated
    invalidated_date: Optional[datetime] = None

class SMCScannerResult(BaseModel):
    symbol: str
    ltp: float
    zone_id: int
    zone_high: float
    zone_low: float
    zone_width_pct: float
    distance_pct: float
    created_date: datetime
    zone_age_days: int
    event: str
    status: str

class SMCHistoryEvent(BaseModel):
    symbol: str
    date: datetime
    state: str # "New", "Active", "Removed"
    survival_days: Optional[int] = None
