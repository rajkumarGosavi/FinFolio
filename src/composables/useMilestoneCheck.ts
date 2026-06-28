import { invoke } from "@tauri-apps/api/core";
import { APP_NAME } from "@/constants";
import { useToast } from "primevue/usetoast";
import { useNotifications } from "@/composables/useNotifications";
import { useGamificationSafe } from "@/composables/useGamification";

interface MilestoneHit { id: number; amount: number; label: string; }

export function useMilestoneCheck() {
    const toast = useToast();
    const { nativeNotify } = useNotifications();
    const { awardXP, celebrate, checkBadges } = useGamificationSafe();

    async function checkMilestones(netWorth: number) {
        const hits = await invoke<MilestoneHit[]>("check_milestones", { netWorth }).catch(() => []);
        for (const m of hits) {
            toast.add({
                severity: "success",
                summary: "Milestone reached!",
                detail: `Your net worth crossed ${m.label} 🎉`,
                life: 12000,
            });
            nativeNotify(`${APP_NAME} — Milestone reached!`, `Your net worth crossed ${m.label}! 🎉`);
            await awardXP("milestone_crossed", 100);
            celebrate();
            await checkBadges({ checkFirstMilestone: true, checkCroreClub: m.amount >= 10_000_000 });
        }
    }

    return { checkMilestones };
}
