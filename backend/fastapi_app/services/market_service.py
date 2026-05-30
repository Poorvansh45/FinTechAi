"""
FinAI Edge — Market Data Service (Orchestrator)
==================================================
Chains market data providers with fallback: Groww → yfinance → Finnhub.
Includes caching, health tracking, retry logic, and structured logging.
"""

import asyncio
import time
import logging
import pandas as pd
from typing import Optional

from config import get_settings
from market.providers.base import MarketDataProvider, StockQuote, Instrument, Candle
from market.providers.yfinance_provider import YFinanceProvider
from market.providers.groww import GrowwProvider
from market.providers.finnhub_provider import FinnhubProvider
from utils.cache import quote_cache, candle_cache, search_cache

log = logging.getLogger("finai_edge.market_service")

# Provider cooldown after failure (seconds)
PROVIDER_COOLDOWN = 60
# Max retries per provider for transient errors
MAX_RETRIES = 2
# Backoff base (seconds) between retries
RETRY_BACKOFF_BASE = 1.0


class MarketDataService:
    """
    Unified market data facade with fallback chain, caching, and retries.

    Priority: Groww → yfinance → Finnhub
    Each provider is tried in order; failures trigger retries with
    exponential backoff. Persistently failed providers enter a cooldown.
    """

    def __init__(self):
        settings = get_settings()
        self._providers: list[MarketDataProvider] = []
        self._provider_failures: dict[str, float] = {}
        self._provider_error_counts: dict[str, int] = {}

        # Build provider chain based on availability
        if settings.groww_available:
            self._providers.append(
                GrowwProvider(
                    api_key=settings.groww_api_key,
                    api_secret=settings.groww_totp_secret or "",
                )
            )
            log.info("  Provider: Groww ✓ (primary)")

        # yfinance is always available (no API key needed)
        self._yfinance = YFinanceProvider()
        self._providers.append(self._yfinance)
        log.info("  Provider: yfinance ✓ (default)")

        if settings.finnhub_available:
            self._providers.append(
                FinnhubProvider(api_key=settings.finnhub_api_key)
            )
            log.info("  Provider: Finnhub ✓ (tertiary)")

        log.info(f"  MarketDataService initialized with {len(self._providers)} providers")

    def _is_provider_healthy(self, provider: MarketDataProvider) -> bool:
        """Check if a provider is not in cooldown from recent failure."""
        last_failure = self._provider_failures.get(provider.name, 0)
        return (time.time() - last_failure) > PROVIDER_COOLDOWN

    def _mark_provider_failed(self, provider: MarketDataProvider) -> None:
        """Mark a provider as recently failed."""
        self._provider_failures[provider.name] = time.time()
        count = self._provider_error_counts.get(provider.name, 0) + 1
        self._provider_error_counts[provider.name] = count
        if count % 5 == 0:
            log.warning(
                f"Provider {provider.name} has failed {count} times total "
                f"(cooldown: {PROVIDER_COOLDOWN}s)"
            )

    def _mark_provider_healthy(self, provider: MarketDataProvider) -> None:
        """Clear failure state for a provider."""
        self._provider_failures.pop(provider.name, None)

    def clear_cooldowns(self) -> None:
        """Reset all provider cooldown states (admin use)."""
        self._provider_failures.clear()
        log.info("All provider cooldowns cleared")

    # ── Quote ──────────────────────────────────────────────────────

    async def get_quote(self, symbol: str) -> StockQuote:
        """
        Get quote for a symbol, trying each provider in priority order.
        Results are cached for 5 minutes. Retries transient failures.
        """
        cache_key = f"quote:{symbol}"
        cached = await quote_cache.get(cache_key)
        if cached:
            return cached

        for provider in self._providers:
            if not self._is_provider_healthy(provider):
                continue

            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    quote = await asyncio.wait_for(
                        provider.get_quote(symbol),
                        timeout=15.0,
                    )
                    if quote.available:
                        self._mark_provider_healthy(provider)
                        await quote_cache.set(cache_key, quote)
                        log.debug(f"Quote {symbol} via {provider.name}: ₹{quote.price}")
                        return quote
                    # Not available but no error — skip retries
                    break
                except asyncio.TimeoutError:
                    log.warning(
                        f"Provider {provider.name} timed out for quote {symbol} "
                        f"(attempt {attempt}/{MAX_RETRIES})"
                    )
                    if attempt == MAX_RETRIES:
                        self._mark_provider_failed(provider)
                except Exception as e:
                    log.warning(
                        f"Provider {provider.name} failed for quote {symbol} "
                        f"(attempt {attempt}/{MAX_RETRIES}): {e}"
                    )
                    if attempt == MAX_RETRIES:
                        self._mark_provider_failed(provider)
                    else:
                        await asyncio.sleep(RETRY_BACKOFF_BASE * attempt)

        # All providers failed
        log.error(f"All providers failed for quote: {symbol}")
        return StockQuote(ticker=symbol, available=False, source="none")

    async def get_bulk_quotes(self, symbols: list[str]) -> dict[str, StockQuote]:
        """Fetch quotes for multiple symbols concurrently."""
        if not symbols:
            return {}

        tasks = [self.get_quote(sym) for sym in symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        quotes = {}
        for sym, result in zip(symbols, results):
            if isinstance(result, Exception):
                log.warning(f"Bulk quote failed for {sym}: {result}")
                quotes[sym] = StockQuote(ticker=sym, available=False, source="error")
            else:
                quotes[sym] = result

        return quotes

    # ── Search ─────────────────────────────────────────────────────

    async def search(self, query: str, limit: int = 12) -> list[Instrument]:
        """
        Search for instruments. Uses yfinance curated DB as primary
        (fast, offline), falls back to API-based search if needed.
        """
        cache_key = f"search:{query.lower()}:{limit}"
        cached = await search_cache.get(cache_key)
        if cached:
            return cached

        for provider in self._providers:
            if not self._is_provider_healthy(provider):
                continue

            try:
                results = await asyncio.wait_for(
                    provider.search_instruments(query, limit),
                    timeout=10.0,
                )
                if results:
                    self._mark_provider_healthy(provider)
                    await search_cache.set(cache_key, results)
                    return results
            except asyncio.TimeoutError:
                log.warning(f"Search via {provider.name} timed out for '{query}'")
                self._mark_provider_failed(provider)
            except Exception as e:
                log.warning(f"Search via {provider.name} failed: {e}")
                self._mark_provider_failed(provider)

        return []

    # ── Historical Candles ─────────────────────────────────────────

    async def get_historical(
        self,
        symbol: str,
        interval: str = "1d",
        period: str = "1y",
    ) -> list[Candle]:
        """Fetch historical candles with caching and timeouts."""
        cache_key = f"candle:{symbol}:{interval}:{period}"
        cached = await candle_cache.get(cache_key)
        if cached:
            return cached

        for provider in self._providers:
            if not self._is_provider_healthy(provider):
                continue

            try:
                candles = await asyncio.wait_for(
                    provider.get_historical_candles(symbol, interval, period),
                    timeout=20.0,
                )
                if candles:
                    self._mark_provider_healthy(provider)
                    await candle_cache.set(cache_key, candles)
                    return candles
            except asyncio.TimeoutError:
                log.warning(f"Candles via {provider.name} timed out for {symbol}")
                self._mark_provider_failed(provider)
            except Exception as e:
                log.warning(f"Candles via {provider.name} failed for {symbol}: {e}")
                self._mark_provider_failed(provider)

        return []

    # ── Bulk Price Data (for Portfolio Analysis) ───────────────────

    async def get_bulk_prices(
        self,
        tickers: list[str],
        period: str = "2y",
    ) -> pd.DataFrame:
        """
        Bulk download adjusted close prices for portfolio analysis.
        Delegates to yfinance's efficient bulk download with timeout.
        Returns DataFrame with ticker columns and date index.
        """
        try:
            return await asyncio.wait_for(
                self._yfinance.get_bulk_prices(tickers, period),
                timeout=45.0,
            )
        except asyncio.TimeoutError:
            log.error(f"Bulk price download timed out for {len(tickers)} tickers")
            return pd.DataFrame()
        except Exception as e:
            log.error(f"Bulk price download failed: {e}")
            return pd.DataFrame()

    # ── Provider Status ────────────────────────────────────────────

    def get_provider_status(self) -> list[dict]:
        """Get status of all configured providers."""
        return [
            {
                "name": p.name,
                "healthy": self._is_provider_healthy(p),
                "last_failure": self._provider_failures.get(p.name),
                "total_errors": self._provider_error_counts.get(p.name, 0),
            }
            for p in self._providers
        ]

    def get_cache_stats(self) -> dict:
        """Get cache statistics for monitoring."""
        return {
            "quotes": quote_cache.stats,
            "candles": candle_cache.stats,
            "search": search_cache.stats,
        }


# ── Module-level singleton ──────────────────────────────────────────
_service_instance: Optional[MarketDataService] = None


def get_market_service() -> MarketDataService:
    """Get or create the global MarketDataService singleton."""
    global _service_instance
    if _service_instance is None:
        _service_instance = MarketDataService()
    return _service_instance
