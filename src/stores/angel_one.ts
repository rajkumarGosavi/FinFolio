import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { usePortfolioStore } from "@/stores/portfolio";

interface AngelStatus {
    hasConfig: boolean;
    isConnected: boolean;
    tokenDate: string | null;
}

interface SyncResult {
    synced: number;
    errors: string[];
}

export const useAngelOneStore = defineStore("angel_one", {
    state: () => ({
        status: null as AngelStatus | null,
        loginLoading: false,
        syncLoading: false,
        syncResult: null as SyncResult | null,
        error: null as string | null,
    }),

    actions: {
        async fetchStatus() {
            try {
                this.status = await invoke<AngelStatus>("get_angel_status");
            } catch (e: any) {
                this.error = String(e?.message ?? e);
            }
        },

        async saveConfig(apiKey: string, clientId: string) {
            this.error = null;
            try {
                await invoke("save_angel_config", { apiKey, clientId });
                await this.fetchStatus();
            } catch (e: any) {
                this.error = String(e?.message ?? e);
                throw e;
            }
        },

        async login(password: string, totp: string) {
            this.loginLoading = true;
            this.error = null;
            try {
                await invoke("login_angel", { password, totp });
                await this.fetchStatus();
            } catch (e: any) {
                this.error = String(e?.message ?? e);
                throw e;
            } finally {
                this.loginLoading = false;
            }
        },

        async syncHoldings() {
            this.syncLoading = true;
            this.syncResult = null;
            this.error = null;
            try {
                const result = await invoke<SyncResult>("sync_angel_holdings");
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
                await invoke("disconnect_angel");
                this.syncResult = null;
                await this.fetchStatus();
            } catch (e: any) {
                this.error = String(e?.message ?? e);
                throw e;
            }
        },
    },
});
