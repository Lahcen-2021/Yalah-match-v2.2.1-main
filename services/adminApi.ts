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

export interface AdminSettings {
    maintenanceMode: boolean;
    maintenanceMessage: string;
    matchOverrides: Record<string, { Tv?: string; hidden?: boolean }>;
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

export const setMatchOverride = (matchId: string, fields: { Tv?: string; hidden?: boolean }) =>
    adminFetch<AdminSettings>(`/overrides/match/${encodeURIComponent(matchId)}`, { method: 'POST', body: JSON.stringify(fields) });

export const removeMatchOverride = (matchId: string) =>
    adminFetch<AdminSettings>(`/overrides/match/${encodeURIComponent(matchId)}`, { method: 'DELETE' });

export interface RawMatch {
    'Match-id': number;
    'Tv'?: string;
    'Cup-Name'?: string;
    'Team-Right'?: { Name?: string };
    'Team-Left'?: { Name?: string };
}

// Convenience lookup for the Matches tab: the public /api/matches route (no admin auth
// needed) returns raw match objects, used here just to let the operator pick a Match-id by
// team names instead of having to know the numeric id up front.
export async function fetchRawMatches(date: string): Promise<RawMatch[]> {
    const res = await fetch(`/api/matches?date=${encodeURIComponent(date)}`);
    if (!res.ok) return [];
    const body = await res.json().catch(() => ({}));
    return body?.['STING-WEB-Matches'] || [];
}
