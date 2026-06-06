import pandas as pd
import numpy as np

def process_smc_zones(df: pd.DataFrame, symbol: str, swing_len: int = 5) -> list[dict]:
    """
    Processes historical candles to identify SMC Demand Zones (Swing High/Low, BOS/CHoCH).
    Expects a DataFrame with 'Date', 'High', 'Low', 'Close'.
    """
    if df.empty or len(df) < swing_len * 2 + 1:
        return []

    df = df.sort_values("Date").reset_index(drop=True)

    # Vectorized Swing detection
    df['SwingHigh'] = (df['High'] == df['High'].rolling(swing_len * 2 + 1, center=True).max())
    df['SwingLow']  = (df['Low'] == df['Low'].rolling(swing_len * 2 + 1, center=True).min())

    trend = None
    last_swing_high = None
    last_swing_low_index = None
    zone_id = 0
    zones = []

    for i in range(len(df)):
        row = df.iloc[i]

        if row['SwingHigh']:
            last_swing_high = row['High']

        if row['SwingLow']:
            last_swing_low_index = i

        # Invalidate zone when candle closes 2% below Zone Low
        for zone in zones:
            if zone['status'] == "Active" and row['Close'] < zone['zone_low'] * 0.98:
                zone['status'] = "Invalidated"
                zone['invalidated_date'] = row['Date']

        # Bullish BOS / CHoCH
        if last_swing_high and row['Close'] > last_swing_high:
            event_type = "BOS" if trend == "bullish" else "CHoCH"

            # Create Demand Zone using the lowest point in the preceding leg
            if last_swing_low_index is not None:
                leg_df = df.iloc[last_swing_low_index:i]

                if not leg_df.empty:
                    ob_idx = leg_df['Low'].idxmin()
                    ob = df.loc[ob_idx]

                    zone_id += 1
                    zones.append({
                        "symbol": symbol,
                        "zone_id": zone_id,
                        "created_date": row['Date'],
                        "event": event_type,
                        "zone_high": round(float(ob['High']), 2),
                        "zone_low": round(float(ob['Low']), 2),
                        "status": "Active",
                        "invalidated_date": None
                    })

            trend = "bullish"
            last_swing_high = None

    # Filter completely failed zones (price falls > 5% below zone low)
    final_zones = []
    for zone in zones:
        zone_df = df[df['Date'] > zone['created_date']]
        if zone_df.empty:
            final_zones.append(zone)
            continue
        
        min_close_after = zone_df['Close'].min()
        if min_close_after < zone['zone_low'] * 0.95:
            # Complete failure, discard it
            continue
            
        final_zones.append(zone)

    return final_zones

def calculate_zone_metrics(zone: dict, ltp: float) -> dict:
    """
    Calculates the distance % to the zone and zone width %.
    """
    zone_high = zone['zone_high']
    zone_low = zone['zone_low']
    
    # Distance Percent
    if ltp > zone_high:
        distance_pct = ((ltp - zone_high) / zone_high) * 100
    elif ltp < zone_low:
        distance_pct = ((zone_low - ltp) / zone_low) * 100
    else:
        distance_pct = 0.0  # Inside zone
        
    # Width Percent
    width_pct = ((zone_high - zone_low) / zone_low) * 100
    
    # Age
    age = (pd.Timestamp.now(tz=zone['created_date'].tzinfo).replace(tzinfo=None) - zone['created_date'].replace(tzinfo=None)).days
    
    # Enrich the zone dict
    zone['ltp'] = ltp
    zone['distance_pct'] = round(distance_pct, 2)
    zone['zone_width_pct'] = round(width_pct, 2)
    zone['zone_age_days'] = age
    
    return zone
