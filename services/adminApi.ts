// Client for the /api/admin/* routes (server.ts + server/adminAuth.ts). Always uses
// relative paths: the admin panel is only reachable from the same origin that serves it
// (the Express server in server.ts), unlike the public app which may fall back to the
// external yallamatch.pages.dev API when hosted as a static Netlify site.
const TOKEN_KEY = 'yalla_admin_token';

export function getAdminToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

export class AdminApiError extends Error {
    constructor(message: string, public status: number) {
        super(message);
    }
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getAdminToken();
    const res = await fetch(`/api/admin${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
    });

    if (res.status === 401) {
        clearAdminToken();
        throw new AdminApiError('Unauthorized', 401);
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new AdminApiError(body.error || `Request failed (${res.status})`, res.status);
    }
    return body as T;
}

export async function login(password: string): Promise<{ token: string; expiresAt: number }> {
    const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new AdminApiError(body.error || 'Login failed', res.status);
    setAdminToken(body.token);
    return body;
}

export interface AdminStatus {
    uptimeMs: number;
    startedAt: string;
    requestCounts: Record<string, number>;
    statusCounts: Record<string, number>;
    recentErrors: { at: string; route: string; status: number }[];
    lastScrapeAt: Record<string, string>;
    memoryCache: { matches: { key: string; ageMs: number; ttlMs: number }[] };
    circuitBreaker: Record<string, { state: string; failureCount: number; threshold: number; cooldownMs: number }>;
    killSwitches: Record<string, boolean>;
    settings: AdminSettings;
}

export interface LiveStreamServer {
    id: string;
    label: string;
    flag?: string;
    url: string;
    type: 'iframe' | 'hls';
}

export interface OverlayAd {
    enabled: boolean;
    imageUrl: string;
    linkUrl: string;
    position: 'bottom' | 'top' | 'bottom-left' | 'bottom-right';
    closeAfterSec: number;
}

export interface LiveConfig {
    enabled: boolean;
    defaultServers: LiveStreamServer[];
    matchServers: Record<string, LiveStreamServer[]>;
    overlayAd?: OverlayAd;
    // Branded-player chrome + prog.txt auto-channel toggle.
    logoUrl?: string;
    bottomText?: string;
    // Logo placement as % of the video box (see BrandingOverlay), tunable per channel.
    logoTopPct?: number;
    logoRightPct?: number;
    logoSizePct?: number;
    logoBackdrop?: boolean;
    // Per-channel overrides of the four fields above; first matching rule wins.
    logoPlacements?: LogoPlacement[];
    playlistEnabled?: boolean;
}

// `match` is a case-insensitive substring of the channel name, so one rule for "bein"
// covers every beIN variant.
export interface LogoPlacement {
    match: string;
    topPct: number;
    rightPct: number;
    sizePct: number;
    backdrop: boolean;
}

// A broadcaster the operator attached to a match by hand (name + optional logo + link).
export interface AdminChannel {
    name: string;
    logo?: string;
    url?: string;
}

// Fields an operator may override on an existing feed match, or apply to a custom one.
export interface MatchOverrideFields {
    Tv?: string;
    hidden?: boolean;
    shown?: boolean;
    'Match-Status'?: string;
    homeScore?: number | null;
    awayScore?: number | null;
    channels?: AdminChannel[];
}

// An admin-created match. Stored compactly; expanded into a STING match at request time.
export interface CustomMatch {
    id: string;
    date: string;            // YYYY-MM-DD (required)
    time: string;            // HH:MM (Africa/Casablanca)
    competition: string;
    competitionLogo?: string;
    homeName: string;
    homeLogo?: string;
    homeScore?: number | null;
    awayName: string;
    awayLogo?: string;
    awayScore?: number | null;
    status: string;          // e.g. لم تبدأ | مباشر | الإستراحة | انتهت
    tv?: string;
}

export interface AdminSettings {
    maintenanceMode: boolean;
    maintenanceMessage: string;
    matchOverrides: Record<string, MatchOverrideFields>;
    hiddenLeagues: string[];
    shownLeagues: string[];
    customMatches: CustomMatch[];
    liveConfig: LiveConfig;
    updatedAt?: string;
}

export const getStatus = () => adminFetch<AdminStatus>('/status');

export const clearMemoryCache = (date?: string) =>
    adminFetch<{ success: boolean }>('/cache/clear', { method: 'POST', body: JSON.stringify({ date }) });

export const refreshMatches = (date: string) =>
    adminFetch<{ success: boolean; data: any }>('/cache/refresh', { method: 'POST', body: JSON.stringify({ date }) });

export const getSources = () =>
    adminFetch<{ sources: { source: string; enabled: boolean }[]; circuitBreaker: AdminStatus['circuitBreaker'] }>('/sources');

export const setSourceEnabled = (source: string, enabled: boolean) =>
    adminFetch<{ success: boolean }>(`/sources/${encodeURIComponent(source)}`, { method: 'POST', body: JSON.stringify({ enabled }) });

export const getSettings = () => adminFetch<AdminSettings>('/settings');

export const updateSettings = (patch: Partial<Pick<AdminSettings, 'maintenanceMode' | 'maintenanceMessage'>>) =>
    adminFetch<AdminSettings>('/settings', { method: 'POST', body: JSON.stringify(patch) });

export const setMatchOverride = (matchId: string, fields: MatchOverrideFields) =>
    adminFetch<AdminSettings>(`/overrides/match/${encodeURIComponent(matchId)}`, { method: 'POST', body: JSON.stringify(fields) });

export const removeMatchOverride = (matchId: string) =>
    adminFetch<AdminSettings>(`/overrides/match/${encodeURIComponent(matchId)}`, { method: 'DELETE' });

// Hide (true) / reveal (false) a whole league on the public site.
export const setLeagueHidden = (league: string, hidden: boolean) =>
    adminFetch<AdminSettings>(`/overrides/league/${encodeURIComponent(league)}`, { method: hidden ? 'POST' : 'DELETE' });

// Force-show (true) / stop force-showing (false) a whole league — pushes a non-major
// league onto the public site.
export const setLeagueShown = (league: string, shown: boolean) =>
    adminFetch<AdminSettings>(`/overrides/league-show/${encodeURIComponent(league)}`, { method: shown ? 'POST' : 'DELETE' });

// --- Custom (admin-created) matches ---

export const getCustomMatches = () => adminFetch<CustomMatch[]>('/custom-matches');

export const saveCustomMatch = (match: CustomMatch) =>
    adminFetch<{ match: CustomMatch; customMatches: CustomMatch[] }>('/custom-match', { method: 'POST', body: JSON.stringify(match) });

export const deleteCustomMatch = (id: string) =>
    adminFetch<{ customMatches: CustomMatch[] }>(`/custom-match/${encodeURIComponent(id)}`, { method: 'DELETE' });

// --- Live stream section (watch servers + promo banner) ---

export const getLiveConfig = () => adminFetch<LiveConfig>('/live');

export const updateLiveConfig = (patch: Partial<Omit<LiveConfig, 'matchServers'>>) =>
    adminFetch<LiveConfig>('/live', { method: 'POST', body: JSON.stringify(patch) });

export const setMatchLiveServers = (matchId: string, servers: LiveStreamServer[]) =>
    adminFetch<LiveConfig>(`/live/match/${encodeURIComponent(matchId)}`, { method: 'POST', body: JSON.stringify({ servers }) });

export const removeMatchLiveServers = (matchId: string) =>
    adminFetch<LiveConfig>(`/live/match/${encodeURIComponent(matchId)}`, { method: 'DELETE' });

export const importFaborServers = (url: string) =>
    adminFetch<{ servers: LiveStreamServer[] }>('/live/import-fabor', { method: 'POST', body: JSON.stringify({ url }) });

// --- Channels directory (admin-managed) ---
export interface AdminChannelServer { name: string; url: string; }
export interface AdminChannelEntry {
    id: string;
    name: string;
    logo: string;
    url: string;
    servers: AdminChannelServer[];
}

export const getAdminChannels = () => adminFetch<AdminChannelEntry[]>('/channels');

export const saveAdminChannels = (channels: AdminChannelEntry[]) =>
    adminFetch<AdminChannelEntry[]>('/channels', { method: 'POST', body: JSON.stringify({ channels }) });

export interface RawTeam { Name?: string; Logo?: string; Goal?: string }

export interface RawMatch {
    'Match-id': number;
    'Tv'?: string;
    'Cup-Name'?: string;
    'Cup-Logo'?: string;
    'Match-Status'?: string;
    'Time-Start'?: string;
    'Time-Zone'?: string;
    'Team-Right'?: RawTeam;
    'Team-Left'?: RawTeam;
}

// The Matches tab reads the ADMIN raw feed (unfiltered): it includes matches that an
// override or a hidden league would remove from the public site, so the operator can
// see and un-hide everything. Custom matches are folded in server-side.
export async function fetchRawMatches(date: string): Promise<RawMatch[]> {
    const body = await adminFetch<{ 'STING-WEB-Matches'?: RawMatch[] }>(`/raw-matches?date=${encodeURIComponent(date)}`)
        .catch(() => ({} as { 'STING-WEB-Matches'?: RawMatch[] }));
    return body?.['STING-WEB-Matches'] || [];
}

// A raw match tagged with the date it belongs to.
//
// This used to carry `day: 'yesterday' | 'today' | 'tomorrow'`, which hard-coded the
// admin to a three-day window. Fixtures are announced weeks ahead, so an operator
// looking for, say, a La Liga match ten days out simply could not see it — and
// therefore could not force it onto the site. The date string is the general form.
export interface DatedRawMatch { match: RawMatch; date: string }

// Morocco-local date (Africa/Casablanca) for today +/- offset, matching the dates
// the public feed is keyed by so the day tabs line up.
function isoOffset(days: number): string {
    const moroccoToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(new Date());
    const d = new Date(`${moroccoToday}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

export { isoOffset as adminIsoOffset };

/**
 * Arabic label for a feed date: أمس / اليوم / غداً for the three days either side of
 * now, and a short weekday + date for anything further out — which is most of the
 * range once the admin looks beyond tomorrow.
 */
export function dayLabel(date: string): string {
    if (date === isoOffset(-1)) return 'أمس';
    if (date === isoOffset(0)) return 'اليوم';
    if (date === isoOffset(1)) return 'غداً';
    try {
        return new Intl.DateTimeFormat('ar', {
            weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Casablanca',
        }).format(new Date(`${date}T12:00:00Z`));
    } catch {
        return date;
    }
}

/**
 * Every fixture between `daysBack` before today and `daysForward` after it.
 *
 * One request per date, run through a small pool rather than all at once: a 30-day
 * range is 31 requests, and firing those simultaneously would trip the backend's
 * per-IP rate limit. Six at a time keeps a cold range comfortably under it while
 * still finishing quickly, and each date is edge-cached, so a re-open is cheap.
 *
 * A single failed date resolves to an empty list inside fetchRawMatches, so one bad
 * day cannot blank the whole range.
 */
export async function fetchMatchesInRange(
    daysBack: number,
    daysForward: number,
    onProgress?: (done: number, total: number) => void,
): Promise<{ dates: string[]; matches: DatedRawMatch[] }> {
    const dates: string[] = [];
    for (let i = -Math.abs(daysBack); i <= daysForward; i++) dates.push(isoOffset(i));

    const matches: DatedRawMatch[] = [];
    let done = 0;
    const POOL = 6;
    let cursor = 0;

    const worker = async () => {
        while (cursor < dates.length) {
            const date = dates[cursor++];
            const list = await fetchRawMatches(date);
            for (const match of list) matches.push({ match, date });
            onProgress?.(++done, dates.length);
        }
    };
    await Promise.all(Array.from({ length: Math.min(POOL, dates.length) }, worker));

    matches.sort((a, b) => a.date.localeCompare(b.date));
    return { dates, matches };
}
