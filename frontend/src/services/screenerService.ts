import axios from "axios";
import { env } from "@/config/env";

const API_URL = env.fastapiUrl;

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

    async getVolumeSurgeSummary(params: Record<string, any> = {}) {
        return scannerClient.get("/api/scanner/volume-surge-summary", { params });
    },

    async getVolumeSurgeDetail(symbol: string) {
        return scannerClient.get("/api/scanner/volume-surge", {
            params: { limit: 1, include_history: true },
        }).then(resp => {
            // Find the specific symbol from results
            const data = resp.data?.data || [];
            return data.find((s: any) => s.symbol === symbol) || null;
        });
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

    async getLaunchPad(params: Record<string, any> = {}) {
        return scannerClient.get("/api/scanner/launchpad", { params });
    },

    async getAlphaZone(params: Record<string, any> = {}) {
        return scannerClient.get("/api/scanner/alpha-zone", { params });
    },

    async triggerScan() {
        return scannerClient.post("/api/v2/scanner/trigger-scan");
    },

    async getScanStatus() {
        return scannerClient.get("/api/v2/scanner/scan-status");
    },
};
