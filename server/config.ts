// Central place to read process.env so call sites never touch process.env directly.
// Must only be imported after 'dotenv/config' has loaded (server.ts does this first).

function parseKillSwitch(raw: string | undefined): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    if (!raw) return map;
    for (const entry of raw.split(',')) {
        const [source, state] = entry.split(':').map(s => s.trim().toLowerCase());
        if (source) map[source] = state !== 'off';
    }
    return map;
}

const killSwitchMap = parseKillSwitch(process.env.SCRAPER_KILL_SWITCH);

export const config = {
    footballDataApiKey: process.env.FOOTBALL_DATA_API_KEY || '',
    circuitBreaker: {
        threshold: Number(process.env.CIRCUIT_BREAKER_THRESHOLD) || 5,
        cooldownMs: Number(process.env.CIRCUIT_BREAKER_COOLDOWN_MS) || 5 * 60 * 1000,
    },
    firebaseAdminCredentials: process.env.FIREBASE_ADMIN_CREDENTIALS || '',
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    rateLimit: {
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
        max: Number(process.env.RATE_LIMIT_MAX) || 60,
    },
    proxyRateLimit: {
        windowMs: Number(process.env.PROXY_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
        // A single page load legitimately fires dozens of proxy calls (channels per date,
        // live, liveonsat, per-match events). 10/min throttled the app against itself, so
        // the floor is raised; loopback requests are exempt entirely (see proxyLimiter.skip).
        max: Number(process.env.PROXY_RATE_LIMIT_MAX) || 120,
    },
};

export function isSourceEnabled(source: string): boolean {
    return killSwitchMap[source.toLowerCase()] !== false;
}
