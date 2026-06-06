import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000";

const scannerClient = axios.create({
    baseURL: API_URL,
});

export const screenerService = {
    async getMomentum() {
        return scannerClient.get("/api/scanner/momentum");
    },

    async getVolumeBreakouts() {
        return scannerClient.get("/api/scanner/volume");
    },

    async getFVG(params: Record<string, any> = {}) {
        return scannerClient.get("/api/scanner/fvg", { params });
    },

    async getTechnicalFilters(params: Record<string, any> = {}) {
        return scannerClient.get("/api/scanner/technical", { params });
    },

    async getVolumeSurges(params: Record<string, any> = {}) {
        return scannerClient.get("/api/scanner/volume-surge", { params });
    },

    async getSMC(params: Record<string, any> = {}) {
        return scannerClient.get("/api/v2/scanner/smc", { params });
    },

    async getSMCStats() {
        return scannerClient.get("/api/v2/scanner/smc/stats");
    },
};