// Operator-editable settings for the /admin panel: maintenance mode and per-match content
// overrides (fix a wrong/missing channel, hide a match). Persisted in the existing public
// `cache` Firestore collection (same shape firestoreCache.ts already writes), so no
// firestore.rules changes are needed — only the password-gated admin routes ever write here.
import { getCachedData, setCachedData } from "../services/firestoreCache.ts";
import { cleanStreamUrl } from "../utils/streamSanitizer.ts";

const SETTINGS_DOC_ID = "admin_settings";
// Settings are operator-driven, not time-decayed cache — read fresh-ish but don't hammer
// Firestore on every single /api/matches request.
const SETTINGS_REFRESH_MS = 10 * 1000;

// A broadcaster the operator attached to a match by hand. Fully replaces whatever
// the site auto-resolves (winwin / scrapers) once set, so the card shows exactly this.
export interface AdminChannel {
    name: string;
    logo?: string;
    url?: string;
}

export interface MatchOverride {
    Tv?: string;
    hidden?: boolean;
    // Force this match onto the public site even if its league isn't a "major" one
    // the site would auto-show. Beats a hidden league; a hidden match still wins.
    shown?: boolean;
    "Match-Status"?: string;
    homeScore?: number | null;
    awayScore?: number | null;
    channels?: AdminChannel[];
    [key: string]: unknown;
}

// An admin-created match, stored compactly and expanded into a STING match at request time.
export interface CustomMatch {
    id: string;
    date: string;   // YYYY-MM-DD
    time: string;   // HH:MM
    competition: string;
    competitionLogo?: string;
    homeName: string;
    homeLogo?: string;
    homeScore?: number | null;
    awayName: string;
    awayLogo?: string;
    awayScore?: number | null;
    status: string;
    tv?: string;
}

// A single watch server shown as a tab above the live player (e.g. "AR 1" 🇲🇦).
// `type` picks how the client renders the url: full-page iframe embed or HLS (.m3u8).
export interface LiveStreamServer {
    id: string;
    label: string;
    flag?: string;
    url: string;
    type: "iframe" | "hls";
}

// The operator's own promo banner drawn OVER the live player (an image that can link out).
export interface OverlayAd {
    enabled: boolean;
    imageUrl: string;
    linkUrl: string;
    position: "bottom" | "top" | "bottom-left" | "bottom-right";
    closeAfterSec: number; // 0 = stays until the viewer closes it
}

export interface LiveConfig {
    // Master switch for the admin-driven live stream section on match pages.
    enabled: boolean;
    // Servers shown on every live match unless a per-match list overrides them.
    defaultServers: LiveStreamServer[];
    // matchId -> servers for that match only.
    matchServers: Record<string, LiveStreamServer[]>;
    // Operator's own ad banner over the player.
    overlayAd: OverlayAd;
    // Player branding: logo (top corner) + caption line (bottom), overlaid on every player.
    logoUrl: string;
    bottomText: string;
    // Logo placement, as a % of the video box — NOT pixels. Broadcasters burn their own
    // bug into the stream at a fixed fraction of the frame, so percentages keep our logo
    // parked on it at every size (mobile, desktop, fullscreen). Tuned per channel by the
    // operator, since each broadcaster puts its bug somewhere slightly different.
    logoTopPct: number;
    logoRightPct: number;
    logoSizePct: number; // logo height as % of video height
    // Opaque rounded plate behind the logo, so a transparent PNG doesn't let the
    // broadcaster's bug show through the gaps.
    logoBackdrop: boolean;
    // Per-channel overrides of the four fields above. Each broadcaster puts its bug in a
    // different spot, so one global placement can only ever be right for one of them.
    logoPlacements: LogoPlacement[];
}

// One placement rule. `match` is a case-insensitive substring of the channel name, so a
// single rule for "bein" covers "beIN Sports Mena 1", "beIN SPORTS HD 1", and friends —
// no need to enumerate every channel variant. First matching rule wins.
export interface LogoPlacement {
    match: string;
    topPct: number;
    rightPct: number;
    sizePct: number;
    backdrop: boolean;
}

const DEFAULT_OVERLAY_AD: OverlayAd = {
    enabled: false,
    imageUrl: "",
    linkUrl: "",
    position: "bottom",
    closeAfterSec: 0,
};

export function sanitizeOverlayAd(input: unknown): OverlayAd {
    const raw = (input && typeof input === "object" ? input : {}) as any;
    const positions = ["bottom", "top", "bottom-left", "bottom-right"];
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const sec = Number(raw.closeAfterSec);
    return {
        enabled: raw.enabled === true,
        imageUrl: str(raw.imageUrl),
        linkUrl: str(raw.linkUrl),
        position: positions.includes(raw.position) ? raw.position : "bottom",
        closeAfterSec: isNaN(sec) ? 0 : Math.min(300, Math.max(0, Math.trunc(sec))),
    };
}

export interface AdminSettings {
    maintenanceMode: boolean;
    maintenanceMessage: string;
    matchOverrides: Record<string, MatchOverride>;
    // League names (Cup-Name) hidden from the public site.
    hiddenLeagues: string[];
    // League names (Cup-Name) force-shown on the public site even if not "major".
    shownLeagues: string[];
    customMatches: CustomMatch[];
    liveConfig: LiveConfig;
    updatedAt?: string;
}

const DEFAULT_LIVE_CONFIG: LiveConfig = {
    enabled: true,
    defaultServers: [],
    matchServers: {},
    overlayAd: DEFAULT_OVERLAY_AD,
    logoUrl: "",
    bottomText: "",
    logoTopPct: 3,
    logoRightPct: 8,
    logoSizePct: 18,
    logoBackdrop: false,
    logoPlacements: [],
};

const DEFAULT_SETTINGS: AdminSettings = {
    maintenanceMode: false,
    maintenanceMessage: "",
    matchOverrides: {},
    hiddenLeagues: [],
    shownLeagues: [],
    customMatches: [],
    liveConfig: DEFAULT_LIVE_CONFIG,
};

// Keep only well-formed { name, logo?, url? } channel rows; drop blanks.
export function sanitizeAdminChannels(input: unknown): AdminChannel[] {
    if (!Array.isArray(input)) return [];
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    return input
        .map((c: any) => ({ name: str(c?.name), logo: str(c?.logo), url: cleanStreamUrl(str(c?.url)) }))
        .filter(c => c.name)
        .slice(0, 12)
        .map(c => ({ name: c.name, ...(c.logo ? { logo: c.logo } : {}), ...(c.url ? { url: c.url } : {}) }));
}

export function sanitizeHiddenLeagues(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    const seen = new Set<string>();
    for (const v of input) {
        const s = typeof v === "string" ? v.trim() : "";
        if (s) seen.add(s);
    }
    return [...seen].slice(0, 300);
}

export function sanitizeCustomMatches(input: unknown): CustomMatch[] {
    if (!Array.isArray(input)) return [];
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const num = (v: unknown) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Math.trunc(Number(v)));
    return input
        .filter((cm: any) => cm && typeof cm === "object" && /^\d{4}-\d{2}-\d{2}$/.test(str(cm.date)))
        .slice(0, 200)
        .map((cm: any) => ({
            id: str(cm.id) || `custom-${Math.random().toString(36).slice(2, 14)}`,
            date: str(cm.date),
            time: /^\d{2}:\d{2}$/.test(str(cm.time)) ? str(cm.time) : "00:00",
            competition: str(cm.competition),
            competitionLogo: str(cm.competitionLogo),
            homeName: str(cm.homeName),
            homeLogo: str(cm.homeLogo),
            homeScore: num(cm.homeScore),
            awayName: str(cm.awayName),
            awayLogo: str(cm.awayLogo),
            awayScore: num(cm.awayScore),
            status: str(cm.status),
            tv: str(cm.tv),
        }));
}

// Expand a stored custom match into the STING shape mapStingMatchToMatch() renders.
export function buildCustomSting(cm: CustomMatch): any {
    return {
        "Match-id": cm.id,
        "Match-Status": cm.status || "لم تبدأ",
        "Time-Start": `${cm.date}T${cm.time}:00`,
        "Time-Zone": "+01:00",
        "Cup-Name": cm.competition,
        "Cup-Logo": cm.competitionLogo || "",
        Tv: cm.tv || "",
        "Team-Right": { Name: cm.homeName, Logo: cm.homeLogo || "", Goal: cm.homeScore == null ? "" : String(cm.homeScore) },
        "Team-Left": { Name: cm.awayName, Logo: cm.awayLogo || "", Goal: cm.awayScore == null ? "" : String(cm.awayScore) },
        __custom: true,
    };
}

export function injectCustomMatches(payload: any, settings: AdminSettings, date?: string): any {
    const customs = settings.customMatches || [];
    if (customs.length === 0) return payload;
    const base = payload && typeof payload === "object" ? payload : {};
    const list = Array.isArray(base["STING-WEB-Matches"]) ? [...base["STING-WEB-Matches"]] : [];
    for (const cm of customs) {
        if (date && cm.date !== date) continue;
        list.push(buildCustomSting(cm));
    }
    return { ...base, "STING-WEB-Matches": list };
}

export async function setCustomMatch(match: CustomMatch): Promise<AdminSettings> {
    const current = await getAdminSettings(true);
    const clean = sanitizeCustomMatches([match]);
    if (clean.length === 0) throw new Error("A valid date (YYYY-MM-DD) is required");
    const m = clean[0];
    const list = [...current.customMatches];
    const idx = list.findIndex(c => c.id === m.id);
    if (idx >= 0) list[idx] = m; else list.push(m);
    return updateAdminSettings({ customMatches: list });
}

export async function deleteCustomMatch(id: string): Promise<AdminSettings> {
    const current = await getAdminSettings(true);
    return updateAdminSettings({ customMatches: current.customMatches.filter(c => c.id !== id) });
}

export function sanitizeServers(input: unknown): LiveStreamServer[] {
    if (!Array.isArray(input)) return [];
    return input
        .filter((s: any) => s && typeof s === "object" && typeof s.url === "string" && s.url.trim())
        .slice(0, 20)
        .map((s: any, i: number) => ({
            id: typeof s.id === "string" && s.id ? s.id : `srv-${i}`,
            label: typeof s.label === "string" && s.label.trim() ? s.label.trim() : `Server ${i + 1}`,
            flag: typeof s.flag === "string" ? s.flag.trim() : "",
            url: cleanStreamUrl(s.url.trim()),
            type: s.type === "hls" ? "hls" : "iframe",
        }));
}

export function sanitizeLiveConfig(input: unknown): LiveConfig {
    const raw = (input && typeof input === "object" ? input : {}) as any;
    const matchServers: Record<string, LiveStreamServer[]> = {};
    if (raw.matchServers && typeof raw.matchServers === "object") {
        for (const [id, servers] of Object.entries(raw.matchServers)) {
            const clean = sanitizeServers(servers);
            if (clean.length > 0) matchServers[String(id)] = clean;
        }
    }
    return {
        enabled: raw.enabled !== false,
        defaultServers: sanitizeServers(raw.defaultServers),
        matchServers,
        overlayAd: sanitizeOverlayAd(raw.overlayAd),
        logoUrl: typeof raw.logoUrl === "string" ? raw.logoUrl.trim().slice(0, 500) : "",
        bottomText: typeof raw.bottomText === "string" ? raw.bottomText.trim().slice(0, 200) : "",
        logoTopPct: pct(raw.logoTopPct, DEFAULT_LIVE_CONFIG.logoTopPct, 0, 90),
        logoRightPct: pct(raw.logoRightPct, DEFAULT_LIVE_CONFIG.logoRightPct, 0, 90),
        logoSizePct: pct(raw.logoSizePct, DEFAULT_LIVE_CONFIG.logoSizePct, 2, 50),
        logoBackdrop: raw.logoBackdrop === true,
        logoPlacements: sanitizeLogoPlacements(raw.logoPlacements),
    };
}

// Drop rules with a blank `match` — they'd match every channel and shadow the rest.
export function sanitizeLogoPlacements(input: unknown): LogoPlacement[] {
    if (!Array.isArray(input)) return [];
    return input
        .map((r: any) => ({
            match: typeof r?.match === "string" ? r.match.trim().slice(0, 60) : "",
            topPct: pct(r?.topPct, DEFAULT_LIVE_CONFIG.logoTopPct, 0, 90),
            rightPct: pct(r?.rightPct, DEFAULT_LIVE_CONFIG.logoRightPct, 0, 90),
            sizePct: pct(r?.sizePct, DEFAULT_LIVE_CONFIG.logoSizePct, 2, 50),
            backdrop: r?.backdrop === true,
        }))
        .filter(r => r.match.length > 0)
        .slice(0, 40);
}

// Percent field with clamping, so a typo in the admin form can't push the logo
// off the video box or blow it up to cover the whole frame.
function pct(value: unknown, fallback: number, min: number, max: number): number {
    const n = Number(value);
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
}

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
                hiddenLeagues: sanitizeHiddenLeagues(data.hiddenLeagues),
                shownLeagues: sanitizeHiddenLeagues(data.shownLeagues),
                customMatches: sanitizeCustomMatches(data.customMatches),
                liveConfig: sanitizeLiveConfig(data.liveConfig),
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
        hiddenLeagues: patch.hiddenLeagues ? sanitizeHiddenLeagues(patch.hiddenLeagues) : current.hiddenLeagues,
        shownLeagues: patch.shownLeagues ? sanitizeHiddenLeagues(patch.shownLeagues) : current.shownLeagues,
        customMatches: patch.customMatches ? sanitizeCustomMatches(patch.customMatches) : current.customMatches,
        liveConfig: patch.liveConfig ? sanitizeLiveConfig(patch.liveConfig) : current.liveConfig,
        updatedAt: new Date().toISOString(),
    };
    await setCachedData(SETTINGS_DOC_ID, next);
    cached = next;
    cachedAt = Date.now();
    return next;
}

// Patch top-level live config fields (enabled / defaultServers) without touching the
// per-match server lists, which have their own setter below.
export async function updateLiveConfig(patch: Partial<Omit<LiveConfig, "matchServers">>): Promise<AdminSettings> {
    const current = await getAdminSettings(true);
    const merged: LiveConfig = {
        ...current.liveConfig,
        ...(typeof patch.enabled === "boolean" ? { enabled: patch.enabled } : {}),
        ...(patch.defaultServers ? { defaultServers: patch.defaultServers } : {}),
        ...(patch.overlayAd ? { overlayAd: sanitizeOverlayAd(patch.overlayAd) } : {}),
        ...(typeof patch.logoUrl === "string" ? { logoUrl: patch.logoUrl.trim().slice(0, 500) } : {}),
        ...(typeof patch.bottomText === "string" ? { bottomText: patch.bottomText.trim().slice(0, 200) } : {}),
        ...(patch.logoTopPct !== undefined ? { logoTopPct: pct(patch.logoTopPct, current.liveConfig.logoTopPct, 0, 90) } : {}),
        ...(patch.logoRightPct !== undefined ? { logoRightPct: pct(patch.logoRightPct, current.liveConfig.logoRightPct, 0, 90) } : {}),
        ...(patch.logoSizePct !== undefined ? { logoSizePct: pct(patch.logoSizePct, current.liveConfig.logoSizePct, 2, 50) } : {}),
        ...(typeof patch.logoBackdrop === "boolean" ? { logoBackdrop: patch.logoBackdrop } : {}),
        ...(patch.logoPlacements ? { logoPlacements: sanitizeLogoPlacements(patch.logoPlacements) } : {}),
        matchServers: current.liveConfig.matchServers,
    };
    return updateAdminSettings({ liveConfig: merged });
}

export async function setMatchLiveServers(matchId: string, servers: LiveStreamServer[] | null): Promise<AdminSettings> {
    const current = await getAdminSettings(true);
    const matchServers = { ...current.liveConfig.matchServers };
    if (servers === null || servers.length === 0) {
        delete matchServers[matchId];
    } else {
        matchServers[matchId] = servers;
    }
    return updateAdminSettings({ liveConfig: { ...current.liveConfig, matchServers } });
}

export async function setMatchOverride(matchId: string, override: MatchOverride | null): Promise<AdminSettings> {
    const current = await getAdminSettings(true);
    const matchOverrides = { ...current.matchOverrides };
    if (override === null) {
        delete matchOverrides[matchId];
    } else {
        const clean: MatchOverride = { ...matchOverrides[matchId], ...override };
        // Normalize / drop the custom channel list so only well-formed rows persist.
        if ("channels" in override) {
            const list = sanitizeAdminChannels(override.channels);
            if (list.length > 0) clean.channels = list; else delete clean.channels;
        }
        matchOverrides[matchId] = clean;
    }
    return updateAdminSettings({ matchOverrides });
}

// Hide or reveal a whole league (Cup-Name) on the public site. Hiding also drops it
// from the force-shown list so the two lists stay mutually exclusive.
export async function setLeagueHidden(league: string, hidden: boolean): Promise<AdminSettings> {
    const name = String(league || "").trim();
    if (!name) throw new Error("League name is required");
    const current = await getAdminSettings(true);
    const hiddenSet = new Set(current.hiddenLeagues);
    const shownSet = new Set(current.shownLeagues);
    if (hidden) { hiddenSet.add(name); shownSet.delete(name); }
    else { hiddenSet.delete(name); }
    return updateAdminSettings({ hiddenLeagues: [...hiddenSet], shownLeagues: [...shownSet] });
}

// Force-show a whole league on the public site (bypassing the major-league filter),
// or clear that. Showing also drops it from the hidden list.
export async function setLeagueShown(league: string, shown: boolean): Promise<AdminSettings> {
    const name = String(league || "").trim();
    if (!name) throw new Error("League name is required");
    const current = await getAdminSettings(true);
    const hiddenSet = new Set(current.hiddenLeagues);
    const shownSet = new Set(current.shownLeagues);
    if (shown) { shownSet.add(name); hiddenSet.delete(name); }
    else { shownSet.delete(name); }
    return updateAdminSettings({ hiddenLeagues: [...hiddenSet], shownLeagues: [...shownSet] });
}

// Applied to the raw "STING-WEB-Matches" payload right before it's sent to the client, on
// every response path (cache hit or fresh fetch) — so toggling an override or maintenance
// mode takes effect immediately without needing to invalidate any cache.
export function applyMatchOverrides(payload: any, settings: AdminSettings): any {
    if (!payload || !Array.isArray(payload["STING-WEB-Matches"])) return payload;
    const overrides = settings.matchOverrides || {};
    const hiddenLeagues = new Set(settings.hiddenLeagues || []);
    const shownLeagues = new Set(settings.shownLeagues || []);
    if (Object.keys(overrides).length === 0 && hiddenLeagues.size === 0 && shownLeagues.size === 0) return payload;

    const out: any[] = [];
    for (const m of payload["STING-WEB-Matches"]) {
        const id = String(m["Match-id"]);
        const league = String(m["Cup-Name"] || "").trim();
        const ov = overrides[id];

        // Visibility precedence (highest first):
        //   match hidden → off · match shown → on · league hidden → off · league shown → on · default
        let forceShown = false;
        if (ov?.hidden) { continue; }
        else if (ov?.shown) { forceShown = true; }
        else if (hiddenLeagues.has(league)) { continue; }
        else if (shownLeagues.has(league)) { forceShown = true; }

        let next: any = m;
        if (ov) {
            const { hidden, shown, homeScore, awayScore, channels, ...fields } = ov;
            next = { ...m, ...fields };
            // Scores map onto the team objects' Goal field without clobbering Name/Logo.
            if (homeScore != null) next["Team-Right"] = { ...(m["Team-Right"] || {}), Goal: String(homeScore) };
            if (awayScore != null) next["Team-Left"] = { ...(m["Team-Left"] || {}), Goal: String(awayScore) };
            // Operator-defined broadcasters ride along as AdminChannels; the client
            // maps them onto match.channels and locks them against auto-resolution.
            if (Array.isArray(channels) && channels.length > 0) next["AdminChannels"] = channels;
        }
        // Tell the client to bypass its major-league filter for force-shown matches.
        if (forceShown) {
            if (next === m) next = { ...m };
            next["AdminShown"] = true;
        }
        out.push(next);
    }
    return { ...payload, "STING-WEB-Matches": out };
}
