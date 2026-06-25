import { computed, watchEffect } from "vue";
import { Chart } from "chart.js";
import { useUiStore } from "@/stores/ui";

function cssVar(name: string, fallback: string): string {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
}

function isDark(): boolean {
    return document.documentElement.classList.contains("app-dark");
}

export function useChartColors() {
    const ui = useUiStore();

    // Keep ChartJS global defaults in sync with theme so tick labels,
    // scale borders, and tooltip defaults are readable in dark mode.
    watchEffect(() => {
        void ui.theme;
        const dark = isDark();
        Chart.defaults.color = dark ? "#94a3b8" : "#64748b";
        Chart.defaults.borderColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
    });

    const textColor = computed(() => {
        void ui.theme;
        return cssVar("--p-text-color", "#374151");
    });

    const mutedColor = computed(() => {
        void ui.theme;
        return cssVar("--p-text-muted-color", "#9ca3af");
    });

    // Use explicit rgba values so grid lines are always visible regardless of
    // what --p-content-border-color resolves to in dark mode (it can be near-black).
    const gridColor = computed(() => {
        void ui.theme;
        return isDark() ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
    });

    const PALETTE = [
        "#3b82f6", // Equity  — blue
        "#8b5cf6", // MF      — purple
        "#06b6d4", // FD      — cyan
        "#10b981", // PPF/EPF — emerald
        "#f59e0b", // Real Est — amber
        "#eab308", // Gold    — yellow
        "#f97316", // Crypto  — orange
        "#ef4444", // Ins.    — red
    ];

    return { textColor, mutedColor, gridColor, PALETTE };
}
