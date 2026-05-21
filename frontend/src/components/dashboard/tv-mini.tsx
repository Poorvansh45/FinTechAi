"use client";

import { useEffect, useRef } from "react";

export function TvMini({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;

    // Map to TradingView format. If not prefixed, default to NSE:<SYMBOL>
    const tvSymbol = symbol.toUpperCase().includes(":") ? symbol.toUpperCase() : `NSE:${symbol.toUpperCase()}`;

    const config = {
      symbol: tvSymbol,
      interval: "D", // 1D timeframe
      hide_top_toolbar: true,
      hide_legend: true,
      allow_symbol_change: false,
      save_image: false,
      studies: [],
      theme: "dark",
      style: "1",
      locale: "en",
      autosize: true,
      backgroundColor: "transparent",
    } as const;

    script.innerHTML = JSON.stringify(config);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [symbol]);

  return (
    <div className="w-full">
      <div className="text-sm font-medium mb-2">{symbol}</div>
      <div ref={containerRef} className="tradingview-widget-container min-h-[260px]" />
    </div>
  );
}
