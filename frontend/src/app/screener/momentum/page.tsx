"use client";

import { useEffect, useState } from "react";
import { screenerService } from "@/services/screenerService";
import ScannerTable from "@/components/screener/ScannerTable";

export default function MomentumScreenerPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        screenerService.getMomentum()
            .then((r) => {
                if (r.data?.success) setData(r.data.data);
                else setError("Failed to fetch momentum stocks.");
            })
            .catch(() => setError("Network error — is FastAPI running on port 8000?"))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-screen bg-gray-950 text-white px-6 py-8 max-w-[1400px] mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Momentum Scanner</h1>
                <p className="text-gray-400 text-sm mt-1">
                    Stocks with RSI &gt; 70 and price above EMA 20 — strong bullish momentum.
                </p>
            </div>
            {error ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                    <strong>Error:</strong> {error}
                </div>
            ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                    <ScannerTable stocks={data} isLoading={loading} />
                </div>
            )}
        </div>
    );
}
