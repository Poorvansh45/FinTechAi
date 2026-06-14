"use client";

/**
 * TechnicalFilters — Updated for EMA % Distance
 * Now delegates to the full screener/page.tsx — this component kept for
 * backward compat with the technical/page.tsx wrapper.
 */
import ScreenerPage from "@/app/screener/page";

export default function TechnicalFilters() {
  return <ScreenerPage />;
}
