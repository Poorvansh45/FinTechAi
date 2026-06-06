import TechnicalFilters from "@/components/screener/TechnicalFilters";

export default function TechnicalScreenerPage() {
    return (
        <main className="p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Technical Screener</h1>
                <p className="text-gray-400">
                    Build custom technical conditions using real-time quant indicators.
                </p>
            </div>
            
            <TechnicalFilters />
        </main>
    );
}
