// Manual "stop scraping this source right now" lever, on top of the automatic
// circuit breaker. Backed by a Firestore doc so flipping it is a single write,
// no redeploy — falls back to the SCRAPER_KILL_SWITCH env var if Firestore is
// unreachable or the doc doesn't exist yet.
import { getCachedData, setCachedData } from "../services/firestoreCache.ts";
import { isSourceEnabled as isSourceEnabledFromEnv } from "./config.ts";

const KILL_SWITCH_DOC_ID = "scraper-config";
const KILL_SWITCH_TTL_MS = 30 * 1000;

let cachedMap: Record<string, boolean> | null = null;
let cachedAt = 0;

async function loadKillSwitchMap(): Promise<Record<string, boolean>> {
    if (cachedMap && Date.now() - cachedAt < KILL_SWITCH_TTL_MS) {
        return cachedMap;
    }
    try {
        const data = await getCachedData(KILL_SWITCH_DOC_ID, KILL_SWITCH_TTL_MS);
        cachedMap = data && typeof data === 'object' ? data : {};
    } catch {
        cachedMap = {};
    }
    cachedAt = Date.now();
    return cachedMap;
}

export async function isSourceEnabled(source: string): Promise<boolean> {
    const map = await loadKillSwitchMap();
    const key = source.toLowerCase();
    if (key in map) return map[key] !== false;
    return isSourceEnabledFromEnv(source);
}

// Used by the admin panel to show current state for sources that haven't been explicitly
// flipped yet (they fall back to the env-var default, same as isSourceEnabled above).
export async function getKillSwitchMap(): Promise<Record<string, boolean>> {
    return { ...(await loadKillSwitchMap()) };
}

// Exposed only via the password-gated /api/admin/sources route (server/adminAuth.ts's
// requireAdmin) — never wire this to an unauthenticated endpoint. Can also still be flipped
// directly with a Firestore console write to cache/scraper-config (e.g. { "kooora": false }).
export async function setSourceEnabled(source: string, enabled: boolean): Promise<void> {
    const map = await loadKillSwitchMap();
    map[source.toLowerCase()] = enabled;
    cachedMap = map;
    cachedAt = Date.now();
    await setCachedData(KILL_SWITCH_DOC_ID, map);
}
