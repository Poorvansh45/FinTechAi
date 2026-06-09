import sys, os, time
sys.path.append(os.path.join(os.path.dirname(__file__), "backend/fastapi_app"))
from dotenv import load_dotenv
import pyotp

load_dotenv("backend/.env")
API_KEY = os.getenv("GROWW_API_KEY")
TOTP_SECRET = os.getenv("GROWW_TOTP_SECRET")

from growwapi import GrowwAPI
totp_gen = pyotp.TOTP(TOTP_SECRET)
totp = totp_gen.now()
access_token = GrowwAPI.get_access_token(api_key=API_KEY, totp=totp)
groww = GrowwAPI(access_token)

from datetime import datetime, timedelta
end_dt = datetime.now()
start_dt = end_dt - timedelta(days=10)
resp = groww.get_historical_candles(
    exchange=groww.EXCHANGE_NSE,
    segment=groww.SEGMENT_CASH,
    groww_symbol="NSE-RELIANCE",
    start_time=start_dt.strftime("%Y-%m-%d %H:%M:%S"),
    end_time=end_dt.strftime("%Y-%m-%d %H:%M:%S"),
    candle_interval=groww.CANDLE_INTERVAL_DAY,
)
print("Keys:", resp.keys())
print("Candles len:", len(resp.get("candles", [])))
if resp.get("candles"):
    print("First candle:", resp["candles"][0])
    print("Length of first candle tuple:", len(resp["candles"][0]))
