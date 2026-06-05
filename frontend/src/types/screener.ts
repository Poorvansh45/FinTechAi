export interface ScreenerResult {
    symbol: string;
    companyName: string;

    price: number;
    changePercent: number;

    volume: number;
    avgVolume?: number;
    volumeRatio?: number;

    rsi?: number;
    ema20?: number;
    ema50?: number;

    macd?: number;
    signal?: number;

    score?: number;
}