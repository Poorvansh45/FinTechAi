"""
FinAI Edge — Utility Helpers
==============================
Currency formatting, validators, and shared math utilities.
"""

import re
import numpy as np
from typing import List, Optional


def format_inr(amount: float) -> str:
    """Format a number as Indian Rupee string (₹1,23,456.78)."""
    if amount < 0:
        return f"-₹{format_inr(-amount)[1:]}"
    integer_part = int(amount)
    decimal_part = f"{amount - integer_part:.2f}"[1:]
    s = str(integer_part)
    if len(s) <= 3:
        return f"₹{s}{decimal_part}"
    last3 = s[-3:]
    rest = s[:-3]
    groups = []
    while rest:
        groups.append(rest[-2:])
        rest = rest[:-2]
    groups.reverse()
    return f"₹{','.join(groups)},{last3}{decimal_part}"


def clean_ticker(ticker: str) -> str:
    """Normalize a ticker symbol: uppercase, trimmed, .NS suffix if bare."""
    t = ticker.strip().upper()
    if not t:
        return t
    # Already has a suffix like .NS or .BO
    if "." in t:
        return t
    # Add .NS for NSE by default
    return f"{t}.NS"


def validate_ticker_format(ticker: str) -> bool:
    """Lightweight format check for ticker symbols."""
    ticker = ticker.strip()
    if not ticker or len(ticker) > 25:
        return False
    return bool(re.match(r"^[A-Za-z0-9][\w.\-&]{0,23}$", ticker))


def safe_sqrt(val: float) -> float:
    """Square root guarded against negative/NaN values."""
    if not np.isfinite(val) or val < 0:
        return 0.0
    return float(np.sqrt(val))


def safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Safe division guarded against zero/NaN."""
    if denominator == 0 or not np.isfinite(denominator):
        return default
    result = numerator / denominator
    return float(result) if np.isfinite(result) else default


def pct_change(old_val: float, new_val: float) -> float:
    """Calculate percentage change between two values."""
    if old_val == 0:
        return 0.0
    return ((new_val - old_val) / abs(old_val)) * 100


def normalize_weights(weights: dict[str, float]) -> dict[str, float]:
    """Normalize weight dict to sum to exactly 1.0."""
    total = sum(weights.values())
    if total == 0:
        n = len(weights)
        return {k: 1.0 / n for k in weights} if n > 0 else weights
    return {k: v / total for k, v in weights.items()}


# ── Curated NSE Stock Database (90 stocks, 14 sectors) ──────────────
# Mirrors the stockDataService.js database for consistency
NSE_STOCK_DATABASE = [
    # Banking (10)
    {"ticker": "HDFCBANK.NS", "name": "HDFC Bank", "sector": "Banking"},
    {"ticker": "ICICIBANK.NS", "name": "ICICI Bank", "sector": "Banking"},
    {"ticker": "SBIN.NS", "name": "State Bank of India", "sector": "Banking"},
    {"ticker": "KOTAKBANK.NS", "name": "Kotak Mahindra Bank", "sector": "Banking"},
    {"ticker": "AXISBANK.NS", "name": "Axis Bank", "sector": "Banking"},
    {"ticker": "INDUSINDBK.NS", "name": "IndusInd Bank", "sector": "Banking"},
    {"ticker": "BANDHANBNK.NS", "name": "Bandhan Bank", "sector": "Banking"},
    {"ticker": "FEDERALBNK.NS", "name": "Federal Bank", "sector": "Banking"},
    {"ticker": "PNB.NS", "name": "Punjab National Bank", "sector": "Banking"},
    {"ticker": "BANKBARODA.NS", "name": "Bank of Baroda", "sector": "Banking"},
    # IT (10)
    {"ticker": "TCS.NS", "name": "Tata Consultancy Services", "sector": "IT"},
    {"ticker": "INFY.NS", "name": "Infosys", "sector": "IT"},
    {"ticker": "WIPRO.NS", "name": "Wipro", "sector": "IT"},
    {"ticker": "HCLTECH.NS", "name": "HCL Technologies", "sector": "IT"},
    {"ticker": "TECHM.NS", "name": "Tech Mahindra", "sector": "IT"},
    {"ticker": "LTIM.NS", "name": "LTIMindtree", "sector": "IT"},
    {"ticker": "PERSISTENT.NS", "name": "Persistent Systems", "sector": "IT"},
    {"ticker": "COFORGE.NS", "name": "Coforge", "sector": "IT"},
    {"ticker": "MPHASIS.NS", "name": "Mphasis", "sector": "IT"},
    {"ticker": "LTTS.NS", "name": "L&T Technology Services", "sector": "IT"},
    # Energy (8)
    {"ticker": "RELIANCE.NS", "name": "Reliance Industries", "sector": "Energy"},
    {"ticker": "ONGC.NS", "name": "Oil & Natural Gas Corp", "sector": "Energy"},
    {"ticker": "BPCL.NS", "name": "Bharat Petroleum", "sector": "Energy"},
    {"ticker": "IOC.NS", "name": "Indian Oil Corporation", "sector": "Energy"},
    {"ticker": "NTPC.NS", "name": "NTPC Limited", "sector": "Energy"},
    {"ticker": "POWERGRID.NS", "name": "Power Grid Corporation", "sector": "Energy"},
    {"ticker": "ADANIGREEN.NS", "name": "Adani Green Energy", "sector": "Energy"},
    {"ticker": "TATAPOWER.NS", "name": "Tata Power", "sector": "Energy"},
    # FMCG (8)
    {"ticker": "HINDUNILVR.NS", "name": "Hindustan Unilever", "sector": "FMCG"},
    {"ticker": "ITC.NS", "name": "ITC Limited", "sector": "FMCG"},
    {"ticker": "NESTLEIND.NS", "name": "Nestle India", "sector": "FMCG"},
    {"ticker": "BRITANNIA.NS", "name": "Britannia Industries", "sector": "FMCG"},
    {"ticker": "DABUR.NS", "name": "Dabur India", "sector": "FMCG"},
    {"ticker": "MARICO.NS", "name": "Marico", "sector": "FMCG"},
    {"ticker": "GODREJCP.NS", "name": "Godrej Consumer Products", "sector": "FMCG"},
    {"ticker": "COLPAL.NS", "name": "Colgate-Palmolive India", "sector": "FMCG"},
    # Auto (7)
    {"ticker": "TATAMOTORS.NS", "name": "Tata Motors", "sector": "Auto"},
    {"ticker": "MARUTI.NS", "name": "Maruti Suzuki", "sector": "Auto"},
    {"ticker": "M&M.NS", "name": "Mahindra & Mahindra", "sector": "Auto"},
    {"ticker": "BAJAJ-AUTO.NS", "name": "Bajaj Auto", "sector": "Auto"},
    {"ticker": "HEROMOTOCO.NS", "name": "Hero MotoCorp", "sector": "Auto"},
    {"ticker": "EICHERMOT.NS", "name": "Eicher Motors", "sector": "Auto"},
    {"ticker": "ASHOKLEY.NS", "name": "Ashok Leyland", "sector": "Auto"},
    # Pharma (8)
    {"ticker": "SUNPHARMA.NS", "name": "Sun Pharmaceutical", "sector": "Pharma"},
    {"ticker": "DRREDDY.NS", "name": "Dr. Reddy's Labs", "sector": "Pharma"},
    {"ticker": "CIPLA.NS", "name": "Cipla", "sector": "Pharma"},
    {"ticker": "DIVISLAB.NS", "name": "Divi's Laboratories", "sector": "Pharma"},
    {"ticker": "APOLLOHOSP.NS", "name": "Apollo Hospitals", "sector": "Pharma"},
    {"ticker": "BIOCON.NS", "name": "Biocon", "sector": "Pharma"},
    {"ticker": "LUPIN.NS", "name": "Lupin", "sector": "Pharma"},
    {"ticker": "FORTIS.NS", "name": "Fortis Healthcare", "sector": "Pharma"},
    # Metals (6)
    {"ticker": "TATASTEEL.NS", "name": "Tata Steel", "sector": "Metals"},
    {"ticker": "HINDALCO.NS", "name": "Hindalco Industries", "sector": "Metals"},
    {"ticker": "JSWSTEEL.NS", "name": "JSW Steel", "sector": "Metals"},
    {"ticker": "VEDL.NS", "name": "Vedanta", "sector": "Metals"},
    {"ticker": "COALINDIA.NS", "name": "Coal India", "sector": "Metals"},
    {"ticker": "NMDC.NS", "name": "NMDC", "sector": "Metals"},
    # Telecom (2)
    {"ticker": "BHARTIARTL.NS", "name": "Bharti Airtel", "sector": "Telecom"},
    {"ticker": "IDEA.NS", "name": "Vodafone Idea", "sector": "Telecom"},
    # Infrastructure (5)
    {"ticker": "LT.NS", "name": "Larsen & Toubro", "sector": "Infrastructure"},
    {"ticker": "ADANIENT.NS", "name": "Adani Enterprises", "sector": "Infrastructure"},
    {"ticker": "ADANIPORTS.NS", "name": "Adani Ports", "sector": "Infrastructure"},
    {"ticker": "SIEMENS.NS", "name": "Siemens India", "sector": "Infrastructure"},
    {"ticker": "ABB.NS", "name": "ABB India", "sector": "Infrastructure"},
    # Finance / NBFC (6)
    {"ticker": "BAJFINANCE.NS", "name": "Bajaj Finance", "sector": "Finance"},
    {"ticker": "BAJAJFINSV.NS", "name": "Bajaj Finserv", "sector": "Finance"},
    {"ticker": "SBILIFE.NS", "name": "SBI Life Insurance", "sector": "Finance"},
    {"ticker": "HDFCLIFE.NS", "name": "HDFC Life Insurance", "sector": "Finance"},
    {"ticker": "ICICIPRULI.NS", "name": "ICICI Prudential Life", "sector": "Finance"},
    {"ticker": "CHOLAFIN.NS", "name": "Cholamandalam Investment", "sector": "Finance"},
    # Consumer (6)
    {"ticker": "TITAN.NS", "name": "Titan Company", "sector": "Consumer"},
    {"ticker": "TRENT.NS", "name": "Trent", "sector": "Consumer"},
    {"ticker": "DMART.NS", "name": "Avenue Supermarts (DMart)", "sector": "Consumer"},
    {"ticker": "PAGEIND.NS", "name": "Page Industries", "sector": "Consumer"},
    {"ticker": "ZOMATO.NS", "name": "Zomato", "sector": "Consumer"},
    {"ticker": "NYKAA.NS", "name": "FSN E-Commerce (Nykaa)", "sector": "Consumer"},
    # Cement (4)
    {"ticker": "ULTRACEMCO.NS", "name": "UltraTech Cement", "sector": "Cement"},
    {"ticker": "SHREECEM.NS", "name": "Shree Cement", "sector": "Cement"},
    {"ticker": "AMBUJACEM.NS", "name": "Ambuja Cements", "sector": "Cement"},
    {"ticker": "ACC.NS", "name": "ACC", "sector": "Cement"},
    # Chemicals (3)
    {"ticker": "PIDILITIND.NS", "name": "Pidilite Industries", "sector": "Chemicals"},
    {"ticker": "SRF.NS", "name": "SRF Limited", "sector": "Chemicals"},
    {"ticker": "AARTI.NS", "name": "Aarti Industries", "sector": "Chemicals"},
    # Real Estate (3)
    {"ticker": "DLF.NS", "name": "DLF", "sector": "Real Estate"},
    {"ticker": "GODREJPROP.NS", "name": "Godrej Properties", "sector": "Real Estate"},
    {"ticker": "OBEROIRLTY.NS", "name": "Oberoi Realty", "sector": "Real Estate"},
    # Oil & Gas (2)
    {"ticker": "GAIL.NS", "name": "GAIL India", "sector": "Oil & Gas"},
    {"ticker": "PETRONET.NS", "name": "Petronet LNG", "sector": "Oil & Gas"},
    # Media (2)
    {"ticker": "ZEEL.NS", "name": "Zee Entertainment", "sector": "Media"},
    {"ticker": "PVR.NS", "name": "PVR INOX", "sector": "Media"},
]


def search_stocks(query: str, limit: int = 12) -> list[dict]:
    """Search curated stock database by ticker, name, or sector."""
    if not query or len(query) < 1:
        return []
    q = query.lower().strip()
    results = [
        s for s in NSE_STOCK_DATABASE
        if q in s["ticker"].lower() or q in s["name"].lower() or q in s["sector"].lower()
    ]
    return results[:limit]


def get_stock_info(ticker: str) -> Optional[dict]:
    """Look up stock info by ticker."""
    t = ticker.upper().strip()
    for s in NSE_STOCK_DATABASE:
        if s["ticker"].upper() == t:
            return s
    return None


def get_sector_for_ticker(ticker: str) -> str:
    """Get sector for a ticker from the curated database."""
    info = get_stock_info(ticker)
    return info["sector"] if info else "Other"


# Sector classification for risk analysis
DEFENSIVE_SECTORS = {"FMCG", "Pharma", "Finance", "Telecom", "Energy"}
AGGRESSIVE_SECTORS = {"IT", "Auto", "Metals", "Real Estate", "Infrastructure", "Chemicals", "Consumer", "Media"}
