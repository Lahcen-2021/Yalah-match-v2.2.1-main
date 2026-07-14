// Operator-editable settings for the /admin panel: maintenance mode and per-match content
// overrides (fix a wrong/missing channel, hide a match). Persisted in the existing public
// `cache` Firestore collection (same shape firestoreCache.ts already writes), so no
// firestore.rules changes are needed — only the password-gated admin routes ever write here.
import { getCachedData, setCachedData } from "../services/firestoreCache.ts";

const SETTINGS_DOC_ID = "admin_settings";
// Settings are operator-driven, not time-decayed cache — read fresh-ish but don't hammer
// Firestore on every single /api/matches request.
const SETTINGS_REFRESH_MS = 10 * 1000;

export interface MatchOverride {
    Tv?: string;
    hidden?: boolean;
    [key: string]: unknown;
}

export interface AdminSettings {
    maintenanceMode: boolean;
    maintenanceMessage: string;
    matchOverrides: Record<string, MatchOverride>;
    updatedAt?: string;
}

const DEFAULT_SETTINGS: AdminSettings = {
    maintenanceMode: false,
    maintenanceMessage: "",
    matchOverrides: {},
};

let cached: AdminSettings | null = null;
let cachedAt = 0;
let pendingLoad: Promise<AdminSettings> | null = null;

async function loadSettings(): Promise<AdminSettings> {
    try {
        const data = await getCachedData(SETTINGS_DOC_ID, Number.MAX_SAFE_INTEGER);
        if (data && typeof data === "object") {
            return {
                maintenanceMode: !!data.maintenanceMode,
                maintenanceMessage: typeof data.maintenanceMessage === "string" ? data.maintenanceMessage : "",
                matchOverrides: data.matchOverrides && typeof data.matchOverrides === "object" ? data.matchOverrides : {},
                updatedAt: data.updatedAt,
            };
        }
    } catch (e) {
        console.error("[AdminSettings] Failed to load, falling back to defaults:", e);
    }
    return { ...DEFAULT_SETTINGS };
}

export async function getAdminSettings(forceRefresh = false): Promise<AdminSettings> {
    if (!forceRefresh && cached && Date.now() - cachedAt < SETTINGS_REFRESH_MS) {
        return cached;
    }
    if (!pendingLoad) {
        pendingLoad = loadSettings().finally(() => { pendingLoad = null; });
    }
    cached = await pendingLoad;
    cachedAt = Date.now();
    return cached;
}

export async function updateAdminSettings(patch: Partial<AdminSettings>): Promise<AdminSettings> {
    const current = await getAdminSettings(true);
    const next: AdminSettings = {
        ...current,
        ...patch,
        matchOverrides: patch.matchOverrides ?? current.matchOverrides,
        updatedAt: new Date().toISOString(),
    };
    await setCachedData(SETTINGS_DOC_ID, next);
    cached = next;
    cachedAt = Date.now();
    return next;
}

export async function setMatchOverride(matchId: string, override: MatchOverride | null): Promise<AdminSettings> {
    const current = await getAdminSettings(true);
    const matchOverrides = { ...current.matchOverrides };
    if (override === null) {
        delete matchOverrides[matchId];
    } else {
        matchOverrides[matchId] = { ...matchOverrides[matchId], ...override };
    }
    return updateAdminSettings({ matchOverrides });
}

// Applied to the raw "STING-WEB-Matches" payload right before it's sent to the client, on
// every response path (cache hit or fresh fetch) — so toggling an override or maintenance
// mode takes effect immediately without needing to invalidate any cache.
export function applyMatchOverrides(payload: any, settings: AdminSettings): any {
    if (!payload || !Array.isArray(payload["STING-WEB-Matches"])) return payload;
    const overrides = settings.matchOverrides || {};
    if (Object.keys(overrides).length === 0) return payload;

    const matches = payload["STING-WEB-Matches"]
        .filter((m: any) => !overrides[String(m["Match-id"])]?.hidden)
        .map((m: any) => {
            const ov = overrides[String(m["Match-id"])];
            if (!ov) return m;
            const { hidden, ...fields } = ov;
            return { ...m, ...fields };
        });
    return { ...payload, "STING-WEB-Matches": matches };
}
