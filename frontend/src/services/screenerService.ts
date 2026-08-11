import axios from "axios";
import { env } from "@/config/env";
import { authHeader } from "@/lib/api/authToken";

const API_URL = env.fastapiUrl;

const scannerClient = axios.create({
    baseURL: API_URL,
    timeout: 120_000,  // 2 min — scan is slow
});

/**
 * Attach the Express-issued JWT to every scanner request.
 *
 * Nivro is a closed private beta and FastAPI now denies by default, so the
 * read endpoints below are no longer public — they were, which is why only
 * triggerScan() used to bother with a token. Doing this in one interceptor
 * rather than per method means a call added later is authenticated by default
 * instead of silently 401-ing.
 */
scannerClient.interceptors.request.use(async (config) => {
    Object.assign(config.headers, await authHeader());
    return config;
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

    async getIpoVintage(params: Record<string, any> = {}) {
        return scannerClient.get("/api/scanner/ipo-vintage", { params });
    },

    async getIpoVintageStudy() {
        return scannerClient.get("/api/scanner/ipo-vintage/study");
    },

    async listIpoListings() {
        return scannerClient.get("/api/v2/scanner/ipo-vintage/listings");
    },

    async addIpoListing(payload: { symbol: string; company_name?: string; listing_date: string; issue_price?: number }) {
        return scannerClient.post("/api/v2/scanner/ipo-vintage/listings", payload);
    },

    /**
     * Manually trigger a full market scan. Requires a signed-in, non-demo user:
     * a scan pins the CPU for 30-40 minutes, so the shared demo account is
     * refused (403). The bearer token comes from the interceptor above.
     */
    async triggerScan() {
        return scannerClient.post("/api/v2/scanner/trigger-scan");
    },

    async getScanStatus() {
        return scannerClient.get("/api/v2/scanner/scan-status");
    },
};
