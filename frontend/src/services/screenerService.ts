import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000";

const scannerClient = axios.create({
    baseURL: API_URL,
    timeout: 120_000,  // 2 min — scan is slow
});

export const screenerService = {
    async getMomentum(params: Record<string, any> = {}) {
        return scannerClient.get("/api/scanner/momentum", { params });
    },

    async getVolumeBreakouts() {
        return scannerClient.get("/api/scanner/volume");
    },

    async getVolumeSurges(params: Record<string, any> = {}) {
        return scannerClient.get("/api/scanner/volume-surge", { params });
    },

    async getFVG(params: Record<string, any> = {}) {
        return scannerClient.get("/api/scanner/fvg", { params });
    },

    async getTechnicalFilters(params: Record<string, any> = {}) {
        return scannerClient.get("/api/scanner/technical", { params });
    },

    async getSMC(params: Record<string, any> = {}) {
        return scannerClient.get("/api/v2/scanner/smc", { params });
    },

    async getSMCStats() {
        return scannerClient.get("/api/v2/scanner/smc/stats");
    },

    async getSMCDetails(symbol: string) {
        return scannerClient.get(`/api/v2/scanner/smc/${symbol}/details`);
    },

    async triggerScan() {
        return scannerClient.post("/api/v2/scanner/trigger-scan");
    },

    async getScanStatus() {
        return scannerClient.get("/api/v2/scanner/scan-status");
    },
};
