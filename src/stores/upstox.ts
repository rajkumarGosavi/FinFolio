import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { usePortfolioStore } from "@/stores/portfolio";

interface UpstoxStatus {
    hasConfig: boolean;
    isConnected: boolean;
    tokenDate: string | null;
}

interface SyncResult {
    synced: number;
    errors: string[];
}

export const useUpstoxStore = defineStore("upstox", {
    state: () => ({
        status: null as UpstoxStatus | null,
        connectLoading: false,
        syncLoading: false,
        syncResult: null as SyncResult | null,
        error: null as string | null,
    }),

    actions: {
        async fetchStatus() {
            try {
                this.status = await invoke<UpstoxStatus>("get_upstox_status");
            } catch (e: any) {
                this.error = String(e?.message ?? e);
            }
        },

        async saveConfig(apiKey: string, apiSecret: string) {
            this.error = null;
            try {
                await invoke("save_upstox_config", { apiKey, apiSecret });
                await this.fetchStatus();
            } catch (e: any) {
                this.error = String(e?.message ?? e);
                throw e;
            }
        },

        async connect() {
            this.connectLoading = true;
            this.error = null;
            try {
                await invoke("start_upstox_login");
                await this.fetchStatus();
            } catch (e: any) {
                this.error = String(e?.message ?? e);
                throw e;
            } finally {
                this.connectLoading = false;
            }
        },

        async syncHoldings() {
            this.syncLoading = true;
            this.syncResult = null;
            this.error = null;
            try {
                const result = await invoke<SyncResult>("sync_upstox_holdings");
                this.syncResult = result;
                const portfolio = usePortfolioStore();
                await portfolio.fetchEquity();
            } catch (e: any) {
                this.error = String(e?.message ?? e);
                throw e;
            } finally {
                this.syncLoading = false;
            }
        },

        async disconnect() {
            this.error = null;
            try {
                await invoke("disconnect_upstox");
                this.syncResult = null;
                await this.fetchStatus();
            } catch (e: any) {
                this.error = String(e?.message ?? e);
                throw e;
            }
        },
    },
});
