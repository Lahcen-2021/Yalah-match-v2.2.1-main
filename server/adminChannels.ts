// Admin-managed TV channels directory (name + logo + link + per-channel servers).
// Stored in its OWN Firestore doc — NOT in admin_settings — so the large list never
// weighs down the per-request settings read on /api/matches.
import { getCachedData, setCachedData } from "../services/firestoreCache.ts";
import { cleanStreamUrl } from "../utils/streamSanitizer.ts";

const DOC_ID = "admin_channels";

export interface AdminChannelServer { name: string; url: string; }
export interface AdminChannelEntry {
    id: string;
    name: string;
    logo: string;
    url: string;
    servers: AdminChannelServer[];
}

export function sanitizeChannels(input: unknown): AdminChannelEntry[] {
    if (!Array.isArray(input)) return [];
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    return input
        .slice(0, 1000)
        .map((c: any, i: number): AdminChannelEntry => {
            const servers: AdminChannelServer[] = Array.isArray(c?.servers)
                ? c.servers
                    .slice(0, 40)
                    .map((s: any) => ({ name: str(s?.name), url: cleanStreamUrl(str(s?.url)) }))
                    .filter((s: AdminChannelServer) => s.url)
                : [];
            return {
                id: str(c?.id) || `ch-${Date.now().toString(36)}-${i}`,
                name: str(c?.name),
                logo: str(c?.logo),
                url: cleanStreamUrl(str(c?.url)),
                servers,
            };
        })
        .filter(c => c.name);
}

let cache: AdminChannelEntry[] | null = null;

export async function getAdminChannels(): Promise<AdminChannelEntry[]> {
    if (cache) return cache;
    try {
        const data = await getCachedData(DOC_ID, Number.MAX_SAFE_INTEGER);
        if (data && Array.isArray((data as any).channels)) {
            cache = sanitizeChannels((data as any).channels);
            return cache;
        }
    } catch (e) {
        console.error("[AdminChannels] load failed:", e);
    }
    return cache || [];
}

export async function setAdminChannels(list: unknown): Promise<AdminChannelEntry[]> {
    const clean = sanitizeChannels(list);
    await setCachedData(DOC_ID, { channels: clean });
    cache = clean;
    return clean;
}
