"""
FinAI Edge — Groww Universe Ingestion
======================================
Isolated service to fetch the master NSE stock universe using the Groww API.
Filters out non-equity, non-cash, and specific ISINs.
"""

import logging
from typing import Any

# Assuming an external GrowwAPI package as specified by the user
try:
    # pyrefly: ignore [missing-import]
    from GrowwAPI import GrowwAPI
except ImportError:
    GrowwAPI = None

log = logging.getLogger("finai_edge.groww_universe")


class GrowwUniverseService:
    def __init__(
        self,
        username: str | None = None,
        password: str | None = None,
        pin: str | None = None,
    ):
        self.username = username
        self.password = password
        self.pin = pin
        self.api = None
        self._init_api()

    def _init_api(self):
        """Initialize the Groww API client and obtain access token."""
        if not GrowwAPI:
            log.warning("GrowwAPI module not found. Universe fetch will use mock data.")
            return

        try:
            # According to user specs:
            # - GrowwAPI.get_access_token()
            # - GrowwAPI()
            if self.username and self.password and self.pin:
                # Login logic (hypothetical depending on library)
                token = GrowwAPI.get_access_token(
                    self.username, self.password, self.pin
                )
            else:
                token = GrowwAPI.get_access_token()

            self.api = GrowwAPI(token=token)
            log.info("Groww API initialized for Universe extraction.")
        except Exception as e:
            log.error(f"Failed to initialize Groww API: {e}")

    def fetch_master_universe(self) -> list[dict[str, Any]]:
        """
        Fetches all instruments and filters for:
        - exchange == 'NSE'
        - segment == 'CASH'
        - series == 'EQ'
        - exclude ISIN starting with 'INF' (Mutual funds usually)
        """
        if not self.api:
            # Mock universe for development if library missing
            log.warning("Using mock universe. Install GrowwAPI for real data.")
            return [
                {
                    "symbol": "RELIANCE",
                    "company_name": "Reliance Industries",
                    "isin": "INE002A01018",
                },
                {
                    "symbol": "TCS",
                    "company_name": "Tata Consultancy Services",
                    "isin": "INE467B01029",
                },
                {
                    "symbol": "HDFCBANK",
                    "company_name": "HDFC Bank",
                    "isin": "INE040A01034",
                },
                {"symbol": "INFY", "company_name": "Infosys", "isin": "INE009A01021"},
            ]

        try:
            all_instruments = self.api.get_all_instruments()
            filtered_universe = []

            for inst in all_instruments:
                exchange = inst.get("exchange", "")
                segment = inst.get("segment", "")
                series = inst.get("series", "")
                isin = inst.get("isin", "")

                if (
                    exchange == "NSE"
                    and segment == "CASH"
                    and series == "EQ"
                    and not isin.startswith("INF")
                ):
                    filtered_universe.append(
                        {
                            "symbol": inst.get("symbol"),
                            "company_name": inst.get("companyName"),
                            "isin": isin,
                            "exchange": exchange,
                        }
                    )

            log.info(
                f"Filtered {len(filtered_universe)} NSE CASH EQ stocks from universe."
            )
            return filtered_universe

        except Exception as e:
            log.error(f"Error fetching universe from Groww: {e}")
            return []


# Singleton instance
universe_service = GrowwUniverseService()
