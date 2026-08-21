import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
// README instructs putting GEMINI_API_KEY in .env.local (Vite convention); load it
// server-side too so keys don't have to be duplicated across .env files.
dotenvConfig({ path: ".env.local" });
import express from "express";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import path from "path";
import cors from "cors";
import compression from "compression";
import { TEAM_TRANSLATIONS } from "./utils/translations";
import { getCachedData, setCachedData } from "./services/firestoreCache.ts";
import { config } from "./server/config.ts";
import * as breaker from "./server/circuitBreaker.ts";
import { isSourceEnabled, setSourceEnabled, getKillSwitchMap } from "./server/killSwitch.ts";
import { FOOTBALL_DATA_COMPETITIONS, fetchFootballDataMatches, fetchFootballDataStandings, mapFootballDataMatchToSting, mapFootballDataStandingsToShared } from "./server/footballDataApi.ts";
import { processMatchUpdates } from "./server/pushTriggers.ts";
import { checkPassword, createAdminToken, isAdminEnabled, requireAdmin } from "./server/adminAuth.ts";
import { getAdminSettings, updateAdminSettings, setMatchOverride, setLeagueHidden, setLeagueShown, applyMatchOverrides, updateLiveConfig, setMatchLiveServers, sanitizeLiveConfig, injectCustomMatches, setCustomMatch, deleteCustomMatch } from "./server/adminSettings.ts";
import { getAdminChannels, setAdminChannels } from "./server/adminChannels.ts";
import { generateMatchSlug } from "./utils/translations.ts";
import { importFaborServers } from "./server/faborTv.ts";
import { handleHlsProxy, assertPublicHost, parseTarget } from "./server/hlsProxy.ts";
import { isAllowedProxyHost } from "./server/proxyAllowlist.ts";
import * as adminMetrics from "./server/adminMetrics.ts";
import { fetchAllNews, fetchArticle } from "./server/newsFeed.ts";

// Sources known to attemptSource() below — surfaced in the admin panel's Sources tab so an
// operator can see/flip kill switches even for a source that hasn't failed (and so isn't in
// the circuit breaker's state map) yet.
const KNOWN_SOURCES = ["yallamatch", "messisporat", "football-data", "espn-standings", "365scores-standings", "365scores-bracket", "espn-scorers", "365scores-scorers", "espn-assists", "365scores-assists", "365scores-fixtures", "bein-guide", "kooora"];

// Upstream STING/jdwel API base. The old `yallamatch.pages.dev` is a dead Pages
// project in a different Cloudflare account; the live backend is the jdwel one.
// Override with BACKEND_BASE in the environment.
const BACKEND_BASE = (process.env.BACKEND_BASE || "https://yallamatchapi-jdwel.pages.dev").replace(/\/$/, "");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(compression());
// Public data routes are meant to be readable cross-origin, so they keep the open
// policy. The admin API is not: `cors()` alone sent Access-Control-Allow-Origin: *
// on /api/admin/* too, letting any page on the internet script against it with a
// stolen token. Admin routes get an allowlist (CORS_ADMIN_ORIGINS, comma-separated)
// and default to same-origin only.
const adminOrigins = (process.env.CORS_ADMIN_ORIGINS || '')
    .split(',').map(o => o.trim()).filter(Boolean);

const adminCors = cors({
    origin: (origin, cb) => {
        // No Origin header = same-origin or a non-browser client; allow.
        if (!origin) return cb(null, true);
        cb(null, adminOrigins.includes(origin));
    },
    credentials: true,
});
const publicCors = cors();

// One dispatcher rather than two app.use() layers: mounting the admin policy first
// and the open one second meant the open one ran afterwards and overwrote
// Access-Control-Allow-Origin back to "*" on admin routes too.
app.use((req, res, next) =>
    req.path.startsWith('/api/admin') ? adminCors(req, res, next) : publicCors(req, res, next));
app.use(express.json());

// Behind a reverse proxy, req.ip is the proxy's address unless Express is told how many
// hops to trust. Set TRUST_PROXY to the number of proxies in front of this server.
app.set("trust proxy", config.trustProxy);

// A local dev client (or the app's own SPA on the same host) is not the abuse vector these
// limiters defend against — it's a single trusted user whose normal page load bursts well past
// any sane per-minute cap. Exempt loopback so the app never rate-limits itself in development.
//
// ONLY when this server is directly exposed. If it sits behind a proxy on the same host,
// req.ip is loopback for every request, so this exemption would switch off rate limiting
// entirely — which is exactly what it used to do.
const exemptLoopback = config.trustProxy === 0;
const isLoopback = (ip?: string): boolean =>
    exemptLoopback && !!ip &&
    (ip === "::1" || ip === "127.0.0.1" || ip === "::ffff:127.0.0.1" || ip.startsWith("::ffff:127."));

// Protects this server's own inbound requests from a single abusive client/bot.
// Does not throttle outbound scraper calls — that is the circuit breaker's job.
app.use(rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isLoopback(req.ip),
}));

const proxyLimiter = rateLimit({
    windowMs: config.proxyRateLimit.windowMs,
    max: config.proxyRateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isLoopback(req.ip),
});

// Tight limiter on the admin login route specifically — it's a single shared password,
// so brute-force attempts need to be slowed down harder than general API traffic.
// skipSuccessfulRequests: only failures count, so an operator logging in normally can
// never lock themselves out.
const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});

// The HLS proxy streams segments, so an unmetered one is a free bandwidth relay.
// Higher ceiling than the generic limiter because one stream is many segment requests.
const hlsLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.HLS_RATE_LIMIT_MAX) || 600,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isLoopback(req.ip),
});

// Records per-route request/error counts for the admin Overview tab. Lives at the top of
// the middleware chain so it sees every request, including ones that 404 or throw.
app.use((req, res, next) => {
    res.on("finish", () => adminMetrics.recordRequest(req.path, res.statusCode));
    next();
});

app.get("/api/health", (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Short-lived response cache + in-flight dedup for the CORS proxy. A single page load fans
// out many identical proxy calls (the same match's events requested by several components,
// channel lists re-fetched per view); without this each one is a separate upstream round-trip
// that also burns the upstream's own rate limit. Keyed by target URL.
const PROXY_CACHE_TTL = 30_000;
const PROXY_CACHE_MAX = 500;
const proxyCache = new Map<string, { data: any; expires: number }>();
const proxyInflight = new Map<string, Promise<any>>();

const getProxied = (url: string): Promise<any> => {
    const cached = proxyCache.get(url);
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.data);

    const existing = proxyInflight.get(url);
    if (existing) return existing; // collapse concurrent identical requests into one fetch

    const p = (async () => {
        const data = await fetchWithStatus(url, 15000, 2);
        if (data != null) {
            // Cap the map so a long-lived server doesn't accumulate stale entries unbounded.
            if (proxyCache.size >= PROXY_CACHE_MAX) {
                const oldest = proxyCache.keys().next().value;
                if (oldest !== undefined) proxyCache.delete(oldest);
            }
            proxyCache.set(url, { data, expires: Date.now() + PROXY_CACHE_TTL });
        }
        return data;
    })().finally(() => proxyInflight.delete(url));

    proxyInflight.set(url, p);
    return p;
};

/**
 * Validate a caller-supplied proxy target.
 *
 * This endpoint used to accept any URL at all, which made it an SSRF gadget
 * (cloud metadata at 169.254.169.254, anything bound on localhost, any service
 * on the private network) whose response was then relayed back to the caller.
 * The WordPress port of the same proxy has always had a host allowlist; this is
 * the Express side catching up, reusing that list and hlsProxy's IP guards.
 *
 * Returns the parsed URL, or an { status, error } to send back.
 */
const vetProxyTarget = async (raw: string): Promise<{ url: URL } | { status: number; error: string }> => {
    let url: URL;
    try {
        url = parseTarget(raw); // rejects anything that isn't http(s)
    } catch {
        return { status: 400, error: "URL must be an absolute http(s) URL" };
    }
    if (!isAllowedProxyHost(url.hostname)) {
        return { status: 403, error: "URL not allowed" };
    }
    try {
        // Blocks a hostname in the allowlist that resolves to a private address.
        await assertPublicHost(url.hostname);
    } catch {
        return { status: 403, error: "URL not allowed" };
    }
    return { url };
};

app.get("/api/proxy", proxyLimiter, async (req, res) => {
    const raw = req.query.url as string;
    if (!raw) return res.status(400).json({ error: "URL parameter is required" });

    const vetted = await vetProxyTarget(raw);
    if ('error' in vetted) {
        console.warn(`[Proxy] Rejected ${raw}: ${vetted.error}`);
        return res.status(vetted.status).json({ error: vetted.error });
    }
    const url = vetted.url.toString();

    try {
        // Cached + deduped wrapper around the rotating fetcher.
        const data = await getProxied(url);

        if (!data) {
            console.error(`[Proxy] All proxies failed for ${url}`);
            return res.status(502).json({ error: "Upstream fetch failed via all proxies" });
        }

        // Never echo an upstream body back as text/html: this endpoint is served
        // from the app's own origin, so doing that turned any allowlisted host
        // (or a compromised one) into stored XSS here - and the 30s proxyCache
        // meant one poisoned fetch was replayed to every later caller. Serve it
        // as inert text instead; callers parse it themselves.
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (typeof data === 'string') {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment');
            return res.send(data);
        }

        res.json(data);
    } catch (e: any) {
        console.error(`[Proxy] Execution error for ${url}:`, e);
        res.status(500).json({ error: "Proxy fetch failed", details: e.message });
    }
});

// Server-side proxies for rotation
const SERVER_PROXIES = [
    (url: string) => url, // Direct
    (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

const fetchWithStatus = async (url: string, timeout = 10000, retries = 1) => {
    let lastError: any = null;
    
    // Try each proxy in rotation
    for (let p = 0; p < SERVER_PROXIES.length; p++) {
        const proxyUrl = SERVER_PROXIES[p](url);
        
        for (let i = 0; i <= retries; i++) {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            
            try {
                const isJson = url.includes('.json') || url.includes('api') || url.includes('365scores');
                const response = await fetch(proxyUrl, { 
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': isJson 
                            ? 'application/json, text/plain, */*'
                            : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
                    }
                });
                clearTimeout(id);
                
                if (response.status === 429) {
                    console.warn(`[Fetch] Rate limited (429) by proxy ${p} for ${url}. Attempt ${i + 1}/${retries + 1}`);
                    if (i < retries) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
                        continue;
                    }
                    break; // Try next proxy
                }
                
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                let data: any;
                const contentType = response.headers.get('content-type') || '';
                
                if (proxyUrl.includes('api.allorigins.win/get')) {
                    const json = await response.json();
                    const contents = json.contents;
                    try {
                        data = JSON.parse(contents);
                    } catch (e) {
                        data = contents; // Fallback to raw text if not JSON
                    }
                } else if (contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = await response.text();
                }
                
                return data;
            } catch (e: any) {
                clearTimeout(id);
                lastError = e;
                if (i < retries && !e.message.includes('429')) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }
            }
        }
    }
    return null;
};

const fetchWithTimeout = (url: string, timeout = 10000) => fetchWithStatus(url, timeout);

// Guards an outbound scraper/API call with the kill switch and circuit breaker so a
// blocked or failing source is skipped immediately instead of retried on every request.
async function attemptSource<T>(
    source: string,
    fn: () => Promise<T>,
    isSuccess: (result: T) => boolean = (r) => !!r
): Promise<T | null> {
    if (!(await isSourceEnabled(source)) || !breaker.canAttempt(source)) {
        return null;
    }
    try {
        const result = await fn();
        if (isSuccess(result)) {
            breaker.recordSuccess(source);
            adminMetrics.recordScrape(source);
        } else {
            breaker.recordFailure(source);
        }
        return result;
    } catch (e) {
        breaker.recordFailure(source);
        throw e;
    }
}

const getMoroccanDateString = (offsetDays: number): string => {
    const d = new Date();
    // Get date in Morocco timezone
    const moroccoDate = new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'Africa/Casablanca', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    }).format(d);
    
    const [year, month, day] = moroccoDate.split('-');
    const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().split('T')[0];
};

app.post("/api/scrape-all", async (req, res) => {
    res.json({ success: true, message: "Scraping is now handled via direct API calls" });
});

const matchesCache: { [key: string]: { data: any, timestamp: number } } = {};
const MATCHES_CACHE_TTL = 10 * 1000; // 10 seconds

// Single exit point for /api/matches so admin-panel maintenance mode and per-match content
// overrides (server/adminSettings.ts) apply on every response path — cache hit or fresh
// fetch alike — without needing to invalidate any cache when an operator changes them.
async function sendMatchesResponse(res: import("express").Response, payload: any, date?: string) {
    const settings = await getAdminSettings();
    if (settings.maintenanceMode) {
        return res.status(503).json({ maintenance: true, message: settings.maintenanceMessage || "الموقع تحت الصيانة حالياً" });
    }
    const withOverrides = applyMatchOverrides(payload, settings);
    return res.json(injectCustomMatches(withOverrides, settings, date));
}

// Resolves the raw matches payload for a date through the cache → source fallback
// chain, WITHOUT applying admin overrides or maintenance mode. Both the public
// /api/matches route and the admin raw-matches route build on this.
async function resolveMatchesPayload(date: string): Promise<any> {
    // 1. Check in-memory cache first for extremely low latency
    const cached = matchesCache[date];
    if (cached && Date.now() - cached.timestamp < MATCHES_CACHE_TTL) {
        console.log(`[API] Returning in-memory cached matches for ${date}`);
        return cached.data;
    }

    // 2. Check Firestore persistent cache
    // If it is today (live games), check every 15 seconds. If past/future, cache is valid for 1 hour.
    const isToday = date === getMoroccanDateString(0);
    const ttl = isToday ? 15000 : 60 * 60 * 1000;
    const fsCached = await getCachedData(`matches_${date}`, ttl);
    if (fsCached) {
        matchesCache[date] = { data: fsCached, timestamp: Date.now() };
        return fsCached;
    }

    // Use user-provided API
    const newApiUrl = `${BACKEND_BASE}/api/matches?date=${date}`;
    const newData = await attemptSource('yallamatch', () => fetchWithTimeout(newApiUrl, 8000), (r) => !!r?.["STING-WEB-Matches"]);
    if (newData && newData["STING-WEB-Matches"]) {
        console.log(`[API] Successfully fetched matches from yallamatch API for ${date}`);
        matchesCache[date] = { data: newData, timestamp: Date.now() };
        setCachedData(`matches_${date}`, newData).catch(err => console.error('[Cache] Save matches failed:', err));
        return newData;
    }

    // Only fallback if primary fails
    const url = `https://www.messisporat.com/matches/npm/?date=${date}&lang=27&time=%2B00%3A00`;
    const data = await attemptSource('messisporat', () => fetchWithTimeout(url, 8000), (r) => !!r?.["STING-WEB-Matches"]);
    if (data && data["STING-WEB-Matches"]) {
        console.log(`[API] Successfully fetched matches for ${date}`);
        matchesCache[date] = { data, timestamp: Date.now() };
        setCachedData(`matches_${date}`, data).catch(err => console.error('[Cache] Save matches fallback failed:', err));
        return data;
    }

    // Last resort: official football-data.org API, scoped to major leagues only
    // (its free tier doesn't cover Botola/Saudi league/AFCON U17 etc).
    const fdMatches = await attemptSource('football-data', () => fetchFootballDataMatches(date, date), (r) => r.length > 0);
    if (fdMatches && fdMatches.length > 0) {
        const filtered = fdMatches.filter((m: any) => Object.values(FOOTBALL_DATA_COMPETITIONS).includes(m.competition?.code));
        if (filtered.length > 0) {
            console.log(`[API] Successfully fetched matches from football-data.org for ${date}`);
            const fdData = { "STING-WEB-Matches": filtered.map(mapFootballDataMatchToSting) };
            matchesCache[date] = { data: fdData, timestamp: Date.now() };
            setCachedData(`matches_${date}`, fdData).catch(err => console.error('[Cache] Save football-data matches failed:', err));
            return fdData;
        }
    }

    console.warn(`[API] No matches found for ${date} or fetch failed`);
    return { "STING-WEB-Matches": [] };
}

// Dynamic sitemap: static pages + every match page for yesterday/today/tomorrow, so
// Google can discover and index the individual match-detail URLs.
app.get("/sitemap.xml", async (_req, res) => {
    const SITE = "https://yallamatch.online";
    const staticPaths = ["/", "/standings", "/tournaments", "/news", "/contact", "/privacy", "/terms"];
    const urls = new Set(staticPaths.map(p => SITE + p));
    try {
        const dates = [getMoroccanDateString(-1), getMoroccanDateString(0), getMoroccanDateString(1)];
        for (const date of dates) {
            const payload = await resolveMatchesPayload(date).catch(() => null);
            const list = payload?.["STING-WEB-Matches"] || [];
            for (const m of list) {
                const home = m?.["Team-Right"]?.Name || "";
                const away = m?.["Team-Left"]?.Name || "";
                const start = m?.["Time-Start"] || date;
                if (home && away) urls.add(SITE + generateMatchSlug(home, away, start));
            }
        }
    } catch (e) {
        console.error("[sitemap] build error:", e);
    }
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        [...urls].map(u => `  <url><loc>${u.replace(/&/g, "&amp;")}</loc></url>`).join("\n") +
        `\n</urlset>\n`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=1800");
    res.send(body);
});

app.get("/api/matches", async (req, res) => {
    const date = req.query.date as string;
    if (!date) {
        console.warn(`[API] Matches call missing date parameter`);
        return res.status(400).json({ error: "Date parameter is required" });
    }

    res.set('Cache-Control', 'public, max-age=10');
    console.log(`[API] Fetching matches for date: ${date}`);

    try {
        const payload = await resolveMatchesPayload(date);
        return sendMatchesResponse(res, payload, date);
    } catch (e) {
        console.error(`[API] Error fetching matches for ${date}:`, e);
        return sendMatchesResponse(res, { "STING-WEB-Matches": [] }, date);
    }
});

// Forces a re-fetch for `date`, bypassing both the in-memory and Firestore caches, and
// writes the result back into both. Used by the admin panel's "force refresh" action.
async function forceRefreshMatches(date: string): Promise<any> {
    delete matchesCache[date];

    const newApiUrl = `${BACKEND_BASE}/api/matches?date=${date}`;
    const newData = await attemptSource('yallamatch', () => fetchWithTimeout(newApiUrl, 8000), (r) => !!r?.["STING-WEB-Matches"]);
    if (newData && newData["STING-WEB-Matches"]) {
        matchesCache[date] = { data: newData, timestamp: Date.now() };
        await setCachedData(`matches_${date}`, newData);
        return newData;
    }

    const url = `https://www.messisporat.com/matches/npm/?date=${date}&lang=27&time=%2B00%3A00`;
    const data = await attemptSource('messisporat', () => fetchWithTimeout(url, 8000), (r) => !!r?.["STING-WEB-Matches"]);
    if (data && data["STING-WEB-Matches"]) {
        matchesCache[date] = { data, timestamp: Date.now() };
        await setCachedData(`matches_${date}`, data);
        return data;
    }

    const fdMatches = await attemptSource('football-data', () => fetchFootballDataMatches(date, date), (r) => r.length > 0);
    if (fdMatches && fdMatches.length > 0) {
        const filtered = fdMatches.filter((m: any) => Object.values(FOOTBALL_DATA_COMPETITIONS).includes(m.competition?.code));
        if (filtered.length > 0) {
            const fdData = { "STING-WEB-Matches": filtered.map(mapFootballDataMatchToSting) };
            matchesCache[date] = { data: fdData, timestamp: Date.now() };
            await setCachedData(`matches_${date}`, fdData);
            return fdData;
        }
    }

    return { "STING-WEB-Matches": [] };
}

const matchDetailsCache: { [key: string]: { data: any, timestamp: number } } = {};
const MATCH_DETAILS_CACHE_TTL = 10 * 1000; // 10 seconds for live data

const getMatchDetails = async (id: string) => {
    const cacheKey = `details_${id}`;
    const cached = matchDetailsCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < MATCH_DETAILS_CACHE_TTL) {
        return cached.data;
    }

    // Check Firestore persistent cache (TTL 30 seconds to support live updates, or 1 hour for past/future)
    // We default to a 30s TTL for details to balance freshness and Firestore load
    const fsCached = await getCachedData(`details_${id}`, 30000);
    if (fsCached) {
        matchDetailsCache[cacheKey] = { data: fsCached, timestamp: Date.now() };
        return fsCached;
    }

    // Try new API first
    const newApiUrl = `${BACKEND_BASE}/api/match-details?id=${id}`;
    const newData = await attemptSource('yallamatch', () => fetchWithTimeout(newApiUrl, 5000), (r) => !!r?.["STING-WEB-Match-Details"]);

    if (newData && newData["STING-WEB-Match-Details"]) {
        matchDetailsCache[cacheKey] = { data: newData, timestamp: Date.now() };
        setCachedData(`details_${id}`, newData).catch(err => console.error('[Cache] Save details failed:', err));
        return newData;
    }

    // Fallback: Fetch constituent parts from messisporat. All three share a host and
    // fail together, so they're tracked under one shared breaker/kill-switch source.
    const eventsUrl = `https://www.messisporat.com/matches/npm/events/?MatchID=${id}&lang=27&time=%2B00%3A00`;
    const statsUrl = `https://www.messisporat.com/matches/npm/stats/?MatchID=${id}`;
    const h2hUrl = `https://www.messisporat.com/matches/npm/h2h/?MatchID=${id}&time=%2B00`;

    const [eventsRes, statsRes, h2hRes] = await attemptSource(
        'messisporat',
        () => Promise.all([
            fetchWithTimeout(eventsUrl, 5000),
            fetchWithTimeout(statsUrl, 5000),
            fetchWithTimeout(h2hUrl, 5000)
        ]),
        (r) => r.some(Boolean)
    ) ?? [null, null, null];

    const combinedData: any = {
        "STING-WEB-Match-Details": {
            ...(eventsRes?.["STING-WEB-Match-Details"] || {}),
            "Match-Stats": statsRes?.["STING-WEB-Match-Details"]?.["Match-Stats"] || statsRes?.["Match-Stats"] || (statsRes && statsRes["Match-Stats"]),
            "Match-H2H": h2hRes?.["STING-WEB-Match-Details"]?.["Match-H2H"] || h2hRes?.["Match-H2H"] || (h2hRes && h2hRes["Match-H2H"]),
            "Statistics-1": statsRes?.["STING-WEB-Match-Details"]?.["Statistics-1"] || statsRes?.["Statistics-1"] || statsRes?.stats?.["Statistics-1"],
            "Statistics-2": statsRes?.["STING-WEB-Match-Details"]?.["Statistics-2"] || statsRes?.["Statistics-2"] || statsRes?.stats?.["Statistics-2"],
        }
    };

    if (eventsRes || statsRes || h2hRes) {
        matchDetailsCache[cacheKey] = { data: combinedData, timestamp: Date.now() };
        setCachedData(`details_${id}`, combinedData).catch(err => console.error('[Cache] Save fallback details failed:', err));
        return combinedData;
    }
    return null;
};

app.get("/api/match-details", async (req, res) => {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "ID parameter is required" });
    res.set('Cache-Control', 'public, max-age=10');
    try {
        const data = await getMatchDetails(id);
        if (data) return res.json(data);
    } catch (e) {
        console.error(`[API] Error fetching match details for ${id}:`, e);
    }
    res.json({ "STING-WEB-Match-Details": {} });
});

app.get("/api/live", async (req, res) => {
    try {
        const url = BACKEND_BASE + "/api/live";
        const data = await fetchWithTimeout(url, 5000);
        if (data) return res.json(data);
    } catch (e) {
        console.error("Error fetching live data:", e);
    }
    res.json({ success: false });
});

app.get("/api/events", async (req, res) => {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "ID parameter is required" });
    res.set('Cache-Control', 'public, max-age=10');

    try {
        const data = await getMatchDetails(id);
        if (data && data["STING-WEB-Match-Details"]) {
            const events = data["STING-WEB-Match-Details"]["Match-Events"];
            if (events) return res.json({ "STING-WEB-Match-Details": { "Match-Events": events } });
        }
    } catch (e) {
        console.error("Error fetching events:", e);
    }
    res.json({});
});

app.get("/api/stats", async (req, res) => {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "ID parameter is required" });
    res.set('Cache-Control', 'public, max-age=10');

    try {
        const data = await getMatchDetails(id);
        if (data && data["STING-WEB-Match-Details"]) {
            const stats = data["STING-WEB-Match-Details"]["Match-Stats"];
            if (stats) return res.json({ "STING-WEB-Match-Details": { "Match-Stats": stats } });
        }
    } catch (e) {
        console.error("Error fetching stats:", e);
    }
    res.json({});
});

app.get("/api/h2h", async (req, res) => {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "ID parameter is required" });
    res.set('Cache-Control', 'public, max-age=10');

    try {
        // Try the dedicated H2H API first from user-provided endpoint
        const h2hUrl = `${BACKEND_BASE}/api/h2h?id=${id}`;
        const h2hData = await fetchWithTimeout(h2hUrl, 5000);
        
        if (h2hData && (h2hData.matches || h2hData["STING-WEB-Match-Details"])) {
            return res.json(h2hData);
        }

        // Fallback to extraction from general match details
        const data = await getMatchDetails(id);
        if (data && data["STING-WEB-Match-Details"]) {
            const details = data["STING-WEB-Match-Details"];
            return res.json({ 
                "STING-WEB-Match-Details": { 
                    "Match-H2H": details["Match-H2H"] || [],
                    "Team-Right-Matches": details["Team-Right-Matches"] || details["Team-H-Matches"] || [],
                    "Team-Left-Matches": details["Team-Left-Matches"] || details["Team-A-Matches"] || []
                } 
            });
        }
    } catch (e) {
        console.error("Error fetching h2h:", e);
    }
    res.json({});
});

app.get("/api/match-info", async (req, res) => {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "ID parameter is required" });
    res.set('Cache-Control', 'public, max-age=10');

    try {
        const data = await getMatchDetails(id);
        if (data && data["STING-WEB-Match-Details"] && data["STING-WEB-Match-Details"]["Match-Info"]) {
            const info = data["STING-WEB-Match-Details"]["Match-Info"];
            return res.json({
                channel: info["Tv"] || info["Channel"] || "غير محدد",
                commentator: info["Commentator"] || "غير محدد"
            });
        }
    } catch (e) {
        console.error("Error fetching match-info:", e);
    }
    res.json({ channel: "غير محدد", commentator: "غير محدد" });
});

// Generic in-memory response cache + in-flight dedup for lightweight JSON endpoints
// (standings, scorers, bracket, news). These were previously refetched from upstream on
// every request past the CDN's max-age; now concurrent and repeat requests within the TTL
// are served from memory and identical upstream fetches are collapsed into one.
const RESPONSE_CACHE_MAX = 300;
const responseCache = new Map<string, { data: any; expires: number }>();
const responseInflight = new Map<string, Promise<any>>();

const cachedJson = <T>(key: string, ttlMs: number, producer: () => Promise<T>): Promise<T> => {
    const cached = responseCache.get(key);
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.data);

    const existing = responseInflight.get(key);
    if (existing) return existing;

    const p = (async () => {
        const data = await producer();
        // Only cache non-empty results so a transient upstream failure isn't pinned for the TTL.
        const isEmpty = data == null || (Array.isArray(data) && data.length === 0);
        if (!isEmpty) {
            if (responseCache.size >= RESPONSE_CACHE_MAX) {
                const oldest = responseCache.keys().next().value;
                if (oldest !== undefined) responseCache.delete(oldest);
            }
            responseCache.set(key, { data, expires: Date.now() + ttlMs });
        }
        return data;
    })().finally(() => responseInflight.delete(key));

    responseInflight.set(key, p);
    return p;
};

// Maps 365scores competition IDs (the IDs used across the app, see CUPS_IDS in
// services/api.ts) to ESPN league slugs for the ESPN standings/scorers fallback.
const STANDINGS_LEAGUE_MAP: Record<string, string> = {
    '7': 'eng.1', '11': 'esp.1', '17': 'ita.1', '25': 'ger.1', '35': 'fra.1',
    '649': 'sau.1',
    '572': 'uefa.champions', '573': 'uefa.europa', '7685': 'uefa.europa.conf',
    '5930': 'fifa.world', '329': 'uefa.euro', '167': 'caf.nations',
    '6067': 'afc.asian.cup', '5096': 'fifa.cwc',
    // Continental club competitions whose league/group phase 365scores does not expose
    // as a table (hasStandings:false) — ESPN carries them, so map them explicitly.
    '623': 'afc.champions',      // دوري أبطال آسيا للنخبة (AFC Champions League Elite)
    '568': 'afc.cup',            // دوري أبطال آسيا 2 (AFC Champions League Two)
    '624': 'caf.champions',      // دوري أبطال أفريقيا (CAF Champions League)
    // Extra domestic leagues that 365scores may not table for this timezone list.
    '113': 'bra.1',              // الدوري البرازيلي
    '141': 'mex.1',              // الدوري المكسيكي
};

const SCORES365_STANDINGS_BASE = `https://webws.365scores.com/web/standings/?appTypeId=5&langId=27&timezoneName=Africa/Casablanca`;
const SCORES365_STATS_BASE = `https://webws.365scores.com/web/stats/?appTypeId=5&langId=27&timezoneName=Africa/Casablanca`;

const mapEspnStandings = (data: any) => {
    const children = Array.isArray(data?.children) ? data.children : [];
    return children.map((group: any) => ({
        name: group.name || data.name || '',
        // ESPN returns entries alphabetically; order the table by rank.
        standings: (Array.isArray(group.standings?.entries) ? group.standings.entries : []).map((row: any) => {
            const getStat = (name: string) => (Array.isArray(row.stats) ? row.stats : []).find((s: any) => s.name === name)?.value || 0;
            return {
                position: getStat('rank') || 0,
                team: { id: row.team?.id, name: row.team?.displayName, crest: row.team?.logos?.[0]?.href },
                playedGames: getStat('gamesPlayed'), won: getStat('wins'), draw: getStat('ties'), lost: getStat('losses'),
                points: getStat('points'), goalsFor: getStat('goalsFor'), goalsAgainst: getStat('goalsAgainst'),
                goalDifference: getStat('pointDifferential'), form: ''
            };
        }).sort((a: any, b: any) => a.position - b.position)
    }));
};

const map365StandingRow = (row: any) => ({
    position: row.position || 0,
    team: {
        id: row.competitor?.id, name: row.competitor?.name,
        crest: `https://imagecache.365scores.com/image/upload/f_png,w_100,h_100,c_limit,q_auto:eco/competitors/${row.competitor?.id}`
    },
    playedGames: row.gamePlayed || 0, won: row.gamesWon || row.won || 0, draw: row.gamesEven || row.draw || 0, lost: row.gamesLost || row.lost || 0,
    points: row.points || 0, goalsFor: row.for ?? row.goalsFor ?? 0, goalsAgainst: row.against ?? row.goalsAgainst ?? 0,
    goalDifference: (row.ratio ?? row.goalsDiff) ?? ((row.for ?? 0) - (row.against ?? 0)), form: ''
});

const map365Standings = (data: any) => {
    const standings = Array.isArray(data?.standings) ? data.standings : [];
    const result: any[] = [];
    for (const stage of standings) {
        const rows = Array.isArray(stage.rows) ? stage.rows : [];
        const groupNames = new Map<number, string>(
            (Array.isArray(stage.groups) ? stage.groups : []).map((g: any) => [g.num, g.name])
        );
        // Cup group stages come back as one flat rows array tagged with groupNum —
        // split them so the client can render one table per group.
        if (groupNames.size > 1) {
            const byGroup = new Map<number, any[]>();
            for (const row of rows) {
                const num = row.groupNum || 0;
                if (!byGroup.has(num)) byGroup.set(num, []);
                byGroup.get(num)!.push(map365StandingRow(row));
            }
            for (const [num, groupRows] of [...byGroup.entries()].sort((a, b) => a[0] - b[0])) {
                result.push({ name: groupNames.get(num) || `المجموعة ${num}`, standings: groupRows });
            }
        } else {
            result.push({ name: stage.name || '', standings: rows.map(map365StandingRow) });
        }
    }
    return result;
};

// Maps the 365scores brackets payload to the compact shape the client renders.
// Knockout stages have stageType 3; league phases (stageType 1) carry no ties.
const map365Bracket = (data: any) => {
    const bracket = Array.isArray(data?.brackets) ? data.brackets[0] : null;
    if (!bracket) return null;
    const stages = (Array.isArray(bracket.stages) ? bracket.stages : [])
        .filter((s: any) => s.stageType === 3 && Array.isArray(s.groups) && s.groups.length > 0)
        .map((s: any) => ({
            num: s.num,
            name: s.name || '',
            isFinal: !!s.isFinal,
            isCurrent: !!s.isCurrentStage,
            ties: s.groups.map((g: any) => {
                const parts = Array.isArray(g.participants) ? g.participants : [];
                const [home, away] = parts;
                const score = Array.isArray(g.score) ? g.score : [];
                const pens = Array.isArray(g.penaltiesScore) ? g.penaltiesScore : [];
                const mapSide = (p: any, idx: number) => p ? {
                    id: p.competitorId || 0,
                    name: p.name || '',
                    winner: !!p.isQualified,
                    score: typeof score[idx] === 'number' && score[idx] >= 0 ? Math.floor(score[idx]) : null,
                    penalties: typeof pens[idx] === 'number' && pens[idx] >= 0 ? Math.floor(pens[idx]) : null,
                } : null;
                const games = Array.isArray(g.games) ? g.games : [];
                return {
                    home: mapSide(home, 0),
                    away: mapSide(away, 1),
                    live: (g.liveCount || 0) > 0,
                    startTime: games[0]?.startTime || null,
                    winDescription: g.winDescription || ''
                };
            })
        }));
    return stages.length > 0 ? { title: bracket.knockoutTitle || bracket.title || '', stages } : null;
};

app.get("/api/standings", async (req, res) => {
    const leagueId = req.query.leagueId as string;
    if (!leagueId) return res.status(400).json({ error: "leagueId parameter is required" });
    res.set('Cache-Control', 'public, max-age=300');

    const result = await cachedJson(`standings:${leagueId}`, 300_000, async () => {
        let mapped: any[] = [];
        // 365scores FIRST: Arabic club names natively. ESPN (English, translated
        // client-side) is the fallback for competitions 365scores doesn't table.
        const s365 = await attemptSource('365scores-standings', () => fetchWithTimeout(`${SCORES365_STANDINGS_BASE}&competitions=${leagueId}`, 10000), (r) => !!r?.standings);
        if (s365) mapped = map365Standings(s365);

        if (mapped.length === 0) {
            const espnLeagueId = STANDINGS_LEAGUE_MAP[leagueId];
            if (espnLeagueId) {
                const data = await attemptSource('espn-standings', () => fetchWithTimeout(`https://site.api.espn.com/apis/v2/sports/soccer/${espnLeagueId}/standings`, 10000), (r) => !!r?.children);
                if (data) mapped = mapEspnStandings(data);
            }
        }

        if (mapped.length === 0) {
            const fdCode = FOOTBALL_DATA_COMPETITIONS[leagueId];
            if (fdCode) {
                const data = await attemptSource('football-data', () => fetchFootballDataStandings(fdCode), (r) => !!r?.standings);
                if (data) mapped = mapFootballDataStandingsToShared(data);
            }
        }
        return mapped;
    });

    res.json(result);
});

// Aggregated football news (RSS feeds, Arabic-translated). 15-minute server cache;
// the CDN may additionally cache for 10 minutes.
app.get("/api/news", async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=600');
    try {
        const items = await cachedJson('news:all', 900_000, fetchAllNews);
        res.json(items);
    } catch (e) {
        console.error("[News] Failed to build news feed:", e);
        res.json([]);
    }
});

// Full article body for the in-site reader. The id must be a link that exists in
// the current news list — that both prevents this from being an open fetch proxy
// (no arbitrary URLs) and guarantees source metadata is available.
app.get("/api/news/article", async (req, res) => {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "id parameter is required" });

    const items = await cachedJson('news:all', 900_000, fetchAllNews);
    const item = Array.isArray(items) ? items.find((it: any) => it.id === id) : null;
    if (!item) return res.status(404).json({ error: "Article not found in the current news list" });

    res.set('Cache-Control', 'public, max-age=1800');
    try {
        // Articles don't change once published — cache the extracted+translated body for 6h.
        const article = await cachedJson(`article:${id}`, 6 * 3600_000, () => fetchArticle(item));
        res.json({ ...item, ...article });
    } catch (e) {
        console.error("[News] Article fetch failed:", e);
        res.json({ ...item, paragraphs: item.description ? [item.description] : [], sourceUrl: item.link });
    }
});

const SCORES365_BRACKETS_BASE = `https://webws.365scores.com/web/brackets/?appTypeId=5&langId=27&timezoneName=Africa/Casablanca`;

// Knockout bracket for cup competitions. Returns { title, stages } or null when the
// competition has no knockout phase (i.e. a plain league) — the client uses that to
// decide between the tournament layout and the classic league table.
app.get("/api/bracket", async (req, res) => {
    const leagueId = req.query.leagueId as string;
    if (!leagueId || !/^\d+$/.test(leagueId)) return res.status(400).json({ error: "A numeric leagueId parameter is required" });
    res.set('Cache-Control', 'public, max-age=300');

    const result = await cachedJson(`bracket:${leagueId}`, 300_000, async () => {
        const data = await attemptSource('365scores-bracket', () => fetchWithTimeout(`${SCORES365_BRACKETS_BASE}&competitions=${leagueId}`, 10000), (r) => !!r?.brackets);
        return data ? map365Bracket(data) : null;
    });
    res.json(result);
});

app.get("/api/scorers", async (req, res) => {
    const leagueId = req.query.leagueId as string;
    if (!leagueId) return res.status(400).json({ error: "leagueId parameter is required" });
    res.set('Cache-Control', 'public, max-age=300');

    const cached = await cachedJson(`scorers:${leagueId}`, 300_000, async () => {
        // 365scores FIRST: Arabic player + club names (langId=27) and real athlete photos.
        // ESPN (English) is only a fallback for competitions 365scores doesn't cover.
        const s365 = await attemptSource('365scores-scorers', () => fetchWithTimeout(`${SCORES365_STATS_BASE}&competitions=${leagueId}&statTypeId=1`, 10000), (r) => !!r?.stats);
        const scorers365 = s365 ? map365AthletesCategory(s365, 1) : [];
        if (scorers365.length > 0) return scorers365;

        const espnLeagueId = STANDINGS_LEAGUE_MAP[leagueId];
        if (espnLeagueId) {
            const data = await attemptSource('espn-scorers', () => fetchWithTimeout(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnLeagueId}/statistics`, 10000), (r) => !!r?.stats);
            const goalsLeaders = Array.isArray(data?.stats) ? data.stats.find((s: any) => s.name === 'goalsLeaders') : null;
            if (Array.isArray(goalsLeaders?.leaders)) {
                return goalsLeaders.leaders.map((leader: any, index: number) => {
                    const getStat = (name: string) => leader.athlete?.statistics?.find((s: any) => s.name === name)?.value || 0;
                    return {
                        rank: index + 1,
                        player: { id: leader.athlete?.id, name: leader.athlete?.displayName, imageUrl: leader.athlete?.headshot?.href || '' },
                        team: { name: leader.athlete?.team?.displayName || '', logoUrl: leader.athlete?.team?.logos?.[0]?.href || '' },
                        goals: leader.value || 0, played: getStat('appearances') || 0
                    };
                });
            }
        }
        return [];
    });

    res.json(cached);
});

// 365scores now returns player stats grouped by category under stats.athletesStats
// (id 1 = goals, id 3 = assists/"صناعة"). Extracts one category into the shared
// scorer shape (the `goals` field carries whatever the category measures).
const map365AthletesCategory = (data: any, categoryId: number) => {
    const cats = data?.stats?.athletesStats;
    if (!Array.isArray(cats)) return [];
    // competitorId → Arabic team name from the response's competitors[] list.
    const teamNames = new Map<string, string>(
        (Array.isArray(data?.competitors) ? data.competitors : []).map((c: any) => [String(c.id), c.name || ''])
    );
    const cat = cats.find((c: any) => c.id === categoryId);
    const rows = Array.isArray(cat?.rows) ? cat.rows : [];
    return rows.map((row: any, index: number) => {
        const compId = String(row.entity?.competitorId ?? '');
        return {
            rank: index + 1,
            player: {
                id: row.entity?.id,
                name: row.entity?.name,
                imageUrl: `https://imagecache.365scores.com/image/upload/f_png,w_100,h_100,c_limit,q_auto:eco/athletes/${row.entity?.id}`
            },
            team: {
                name: teamNames.get(compId) || '',
                logoUrl: `https://imagecache.365scores.com/image/upload/f_png,w_100,h_100,c_limit,q_auto:eco/competitors/${compId}`
            },
            goals: Number(row.stats?.[0]?.value) || 0, played: 0
        };
    });
};

// Top assist providers ("صناع اللعب"): ESPN assistsLeaders, then 365scores category 3.
app.get("/api/assists", async (req, res) => {
    const leagueId = req.query.leagueId as string;
    if (!leagueId) return res.status(400).json({ error: "leagueId parameter is required" });
    res.set('Cache-Control', 'public, max-age=300');

    const cached = await cachedJson(`assists:${leagueId}`, 300_000, async () => {
        // 365scores FIRST (Arabic names + photos); ESPN only as a coverage fallback.
        const s365 = await attemptSource('365scores-assists', () => fetchWithTimeout(`${SCORES365_STATS_BASE}&competitions=${leagueId}`, 10000), (r) => !!r?.stats);
        const assists365 = s365 ? map365AthletesCategory(s365, 3) : [];
        if (assists365.length > 0) return assists365;

        const espnLeagueId = STANDINGS_LEAGUE_MAP[leagueId];
        if (espnLeagueId) {
            const data = await attemptSource('espn-assists', () => fetchWithTimeout(`https://site.api.espn.com/apis/site/v2/sports/soccer/${espnLeagueId}/statistics`, 10000), (r) => !!r?.stats);
            const leaders = Array.isArray(data?.stats) ? data.stats.find((s: any) => s.name === 'assistsLeaders') : null;
            if (Array.isArray(leaders?.leaders)) {
                return leaders.leaders.map((leader: any, index: number) => ({
                    rank: index + 1,
                    player: { id: leader.athlete?.id, name: leader.athlete?.displayName, imageUrl: leader.athlete?.headshot?.href || '' },
                    team: { name: leader.athlete?.team?.displayName || '', logoUrl: leader.athlete?.team?.logos?.[0]?.href || '' },
                    goals: leader.value || 0, played: 0
                }));
            }
        }
        return [];
    });

    res.json(cached);
});

const SCORES365_CURRENT_GAMES_BASE = `https://webws.365scores.com/web/games/current/?appTypeId=5&langId=27&timezoneName=Africa/Casablanca`;

// Classifies a competition fixture as finished / live / upcoming from its status text
// and score (scores come back < 0 when a game hasn't been played).
const map365LeagueMatch = (g: any) => {
    const st = g.statusText || '';
    const homeScore = g.homeCompetitor?.score ?? -1;
    const awayScore = g.awayCompetitor?.score ?? -1;
    const hasScore = homeScore >= 0 && awayScore >= 0;
    const isLive = /الشوط|مباشر|استراح|إضاف|توقف/.test(st) && !/انته|بعد|نهائ/.test(st);
    let state: 'finished' | 'live' | 'upcoming' = 'upcoming';
    if (isLive) state = 'live';
    else if (hasScore || /انته|بعد|نهائ/.test(st)) state = 'finished';
    return {
        id: g.id,
        home: { id: g.homeCompetitor?.id, name: g.homeCompetitor?.name || '' },
        away: { id: g.awayCompetitor?.id, name: g.awayCompetitor?.name || '' },
        homeScore: hasScore ? Math.floor(homeScore) : null,
        awayScore: hasScore ? Math.floor(awayScore) : null,
        startTime: g.startTime || null,
        statusText: st,
        round: g.stageName || (g.roundName && g.roundNum ? `${g.roundName} ${g.roundNum}` : ''),
        state,
    };
};

// A competition's recent + upcoming fixtures window (games/current), for the
// "المباريات القادمة" / "المباريات المنتهية" tabs. The client splits by `state`.
app.get("/api/league-matches", async (req, res) => {
    const leagueId = req.query.leagueId as string;
    if (!leagueId || !/^\d+$/.test(leagueId)) return res.status(400).json({ error: "A numeric leagueId parameter is required" });
    res.set('Cache-Control', 'public, max-age=120');

    const result = await cachedJson(`league-matches:${leagueId}`, 120_000, async () => {
        const data = await attemptSource('365scores-fixtures', () => fetchWithTimeout(`${SCORES365_CURRENT_GAMES_BASE}&competitions=${leagueId}`, 10000), (r) => Array.isArray(r?.games));
        const games = Array.isArray(data?.games) ? data.games.filter((g: any) => String(g.competitionId) === leagueId) : [];
        return games.map(map365LeagueMatch);
    });

    res.json(result);
});

const koooraCache: { [key: string]: { data: any, timestamp: number } } = {};
const KOOORA_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Deduplicate parallel outgoing requests for the same URL
const pendingRequests = new Map<string, Promise<any>>();

const fetchWithDedupe = async (url: string, timeout = 10000) => {
    if (pendingRequests.has(url)) {
        return pendingRequests.get(url);
    }
    
    const promise = fetchWithTimeout(url, timeout).finally(() => {
        pendingRequests.delete(url);
    });
    
    pendingRequests.set(url, promise);
    return promise;
};

const REVERSE_TEAM_TRANSLATIONS: { [key: string]: string[] } = {};
Object.entries(TEAM_TRANSLATIONS).forEach(([en, ar]) => {
    if (!REVERSE_TEAM_TRANSLATIONS[ar]) {
        REVERSE_TEAM_TRANSLATIONS[ar] = [];
    }
    REVERSE_TEAM_TRANSLATIONS[ar].push(en.toLowerCase());
    
    // Also add common variations
    const cleanEn = en.replace(/\s+FC$|\s+SFC$|\s+Club$|\s+CF$|\s+BC$|\s+AC$|\s+SCO$|\s+HSC$|\s+AS$|\s+RC$|\s+OGC$|\s+AJ$|\s+ESTAC$|\s+LOSC$/i, '').trim();
    if (!REVERSE_TEAM_TRANSLATIONS[ar].includes(cleanEn.toLowerCase())) {
        REVERSE_TEAM_TRANSLATIONS[ar].push(cleanEn.toLowerCase());
    }
});

// Add manual aliases for better matching
const MANUAL_ALIASES: { [key: string]: string[] } = {
    'باريس أف.سي.': ['paris fc', 'paris'],
    'باريس إف سي': ['paris fc', 'paris'],
    'باريس اف سي': ['paris fc', 'paris'],
    'لو آفر': ['le havre'],
    'لو هافر': ['le havre'],
    'لوهافر': ['le havre'],
    'باريس سان جيرمان': ['psg', 'paris sg', 'paris saint germain'],
    'أولمبيك مارسيليا': ['marseille', 'om'],
    'أولمبيك ليون': ['lyon', 'ol'],
    'ستاد رين': ['rennes'],
    'ستراسبورج': ['strasbourg'],
    'نيس': ['nice'],
    'لانس': ['lens'],
    'أنجيه': ['angers'],
    'تولوز': ['toulouse'],
    'لوريان': ['loriant', 'lorient'],
    'أوكسير': ['auxerre'],
    'بريست': ['brest'],
    'نانت': ['nantes'],
    'مونبلييه': ['montpellier'],
    'سانت إيتيان': ['saint etienne', 'asse'],
    'موناكو': ['monaco'],
    'ليل': ['lille'],
    'ميتز': ['metz'],
    'دانكيرك': ['dunkerque'],
    'روديز': ['rodez'],
    'باو': ['pau'],
    'أميان': ['amiens'],
    'غانغان': ['guingamp'],
    'لافال': ['laval'],
    'كاين': ['caen'],
    'أنسي': ['annecy'],
    'غرونوبل': ['grenoble'],
    'باستيا': ['bastia'],
    'ريد ستار': ['red star'],
    'مارتيغ': ['martigues'],
    'تروا': ['troyes'],
    'ريال مدريد': ['real madrid'],
    'برشلونة': ['barcelona', 'barca'],
    'مانشستر سيتي': ['man city', 'manchester city'],
    'مانشستر يونايتد': ['man utd', 'manchester united'],
    'ليفربول': ['liverpool'],
    'أرسنال': ['arsenal'],
    'تشيلسي': ['chelsea'],
    'بايرن ميونخ': ['bayern munich', 'bayern munchen'],
    'بروسيا دورتموند': ['dortmund', 'borussia dortmund'],
    'ميلان': ['ac milan'],
    'إنتر ميلان': ['inter milan', 'internazionale'],
    'يوفنتوس': ['juventus'],
    'روما': ['as roma'],
    'لاتسيو': ['lazio'],
    'نابولي': ['napoli'],
};

Object.entries(MANUAL_ALIASES).forEach(([ar, aliases]) => {
    if (!REVERSE_TEAM_TRANSLATIONS[ar]) {
        REVERSE_TEAM_TRANSLATIONS[ar] = [];
    }
    aliases.forEach(alias => {
        if (!REVERSE_TEAM_TRANSLATIONS[ar].includes(alias.toLowerCase())) {
            REVERSE_TEAM_TRANSLATIONS[ar].push(alias.toLowerCase());
        }
    });
});

app.get("/api/bein-channels", async (req, res) => {
    const teamA = req.query.teamA as string;
    const teamB = req.query.teamB as string;
    
    if (!teamA || !teamB) return res.json({ channels: [] });

    res.set('Cache-Control', 'public, max-age=300');
    try {
        // Try new API first
        const newApiUrl = `${BACKEND_BASE}/api/bein-channels?teamA=${encodeURIComponent(teamA)}&teamB=${encodeURIComponent(teamB)}`;
        const newData = await fetchWithTimeout(newApiUrl, 5000);
        if (newData && newData.channels && newData.channels.length > 0) {
            return res.json(newData);
        }

        const filePath = path.join(process.cwd(), 'bein_epg.json');
        const data = await fs.readFile(filePath, 'utf8');
        const channels = JSON.parse(data);
        
        const foundChannels: string[] = [];
        
        // Find English names/aliases for the Arabic teams
        const aliasesA = REVERSE_TEAM_TRANSLATIONS[teamA] || [teamA.toLowerCase()];
        const aliasesB = REVERSE_TEAM_TRANSLATIONS[teamB] || [teamB.toLowerCase()];
        
        channels.forEach((channel: any) => {
            const hasMatch = channel.programs?.some((prog: any) => {
                const title = prog.title?.toLowerCase() || '';
                // Check if any alias of teamA AND any alias of teamB are in the title
                const matchA = aliasesA.some(alias => title.includes(alias));
                const matchB = aliasesB.some(alias => title.includes(alias));
                return matchA && matchB;
            });
            
            if (hasMatch) {
                foundChannels.push(channel.name);
            }
        });
        
        res.json({ channels: foundChannels });
    } catch (e) {
        console.error("Error searching beIN channels:", e);
        res.json({ channels: [] });
    }
});

// Full beIN Sports program guide (all channels + their schedules), reduced to the
// "now" and "next" program per channel. Distinct from /api/bein-channels above, which
// looks up the channels airing one specific match.
app.get("/api/bein-guide", async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=600');
    const result = await cachedJson('bein-guide', 600_000, async () => {
        const data = await attemptSource('bein-guide', () => fetchWithTimeout(BACKEND_BASE + '/api/bein-channels', 8000), (r) => Array.isArray(r?.channels));
        const channels = Array.isArray(data?.channels) ? data.channels : [];
        const now = Date.now();
        return channels.map((ch: any) => {
            const progs = (Array.isArray(ch.programs) ? ch.programs : [])
                .map((p: any) => ({ title: p.title, start: p.start, t: new Date(p.start).getTime() }))
                .filter((p: any) => !isNaN(p.t))
                .sort((a: any, b: any) => a.t - b.t);
            let current: any = null, next: any = null;
            for (const p of progs) {
                if (p.t <= now) current = p;
                else { next = p; break; }
            }
            return {
                name: ch.name,
                now: current ? { title: current.title, start: current.start } : null,
                next: next ? { title: next.title, start: next.start } : null,
            };
        }).filter((c: any) => c.now || c.next);
    });
    res.json(result);
});

app.get("/api/kooora/events", async (req, res) => {
    let url = req.query.url as string;
    if (!url) return res.status(400).json({ error: "URL parameter is required" });

    if (url.startsWith('/')) {
        url = `https://www.kooora.com${url}`;
    }

    res.set('Cache-Control', 'public, max-age=300');
    try {
        // Try new API first. Tracked under the shared "kooora" source along with the
        // direct scrape below since both ultimately depend on kooora.com being reachable.
        const newApiUrl = `${BACKEND_BASE}/api/kooora/events?url=${encodeURIComponent(url)}`;
        const newData = await attemptSource('kooora', () => fetchWithTimeout(newApiUrl, 5000), (r) => !!r?.success);
        if (newData && newData.success) {
            return res.json(newData);
        }

        console.log("Fetching Kooora events from URL:", url);
        const html = await attemptSource('kooora', () => fetchWithStatus(url, 10000, 1), (r) => typeof r === 'string' && !!r);

        if (!html || typeof html !== 'string') throw new Error(`Fetch failed or did not return text`);
        
        const cheerio = await import('cheerio');
        const $ = cheerio.load(html);
        const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
        
        if (!match) {
            console.error("Could not find __NEXT_DATA__ in Kooora HTML. HTML length:", html.length, "Preview:", html.substring(0, 500));
            return res.status(200).json({ success: false, error: "Could not find __NEXT_DATA__ in Kooora HTML" });
        }

        const nextData = match[1];

        let data;
        try {
            data = JSON.parse(nextData);
        } catch (e) {
            console.error("Failed to parse __NEXT_DATA__ as JSON. nextData length:", nextData.length, "Preview:", nextData.substring(0, 500));
            return res.status(200).json({ success: false, error: "Failed to parse Kooora data" });
        }
        
        const pageProps = data.props?.pageProps;
        
        // Try both keyEvents and events
        const events = pageProps?.data?.match?.events || pageProps?.data?.match?.keyEvents || [];
        const tvChannels = pageProps?.data?.tvChannels || [];
        
        res.json({ success: true, data: events, channels: tvChannels, nextData: data });
    } catch (error: any) {
        console.error("Kooora events scraping error:", error);
        res.status(500).json({ error: "Failed to fetch Kooora events", details: error.message });
    }
});

// Helper to parse Kooora data from __NEXT_DATA__ JSON
const parseKoooraData = (data: any) => {
    const channelsData: any[] = [];
    const pageData = data.props?.pageProps?.data || {};
    
    // Structure 1: scheduleGroups (used in events page)
    const scheduleGroups = pageData.scheduleGroups || [];
    scheduleGroups.forEach((group: any) => {
        (group.events || []).forEach((match: any) => {
            const rawChannels = match.schedule || match.tvChannels || match.broadcasts || [];
            channelsData.push({
                name: match.name,
                startDate: match.startDate,
                status: match.status,
                url: match.urlLink?.url,
                channels: (Array.isArray(rawChannels) ? rawChannels : []).map((s: any) => ({
                    name: typeof s === 'string' ? s : s.name,
                    logo: typeof s === 'string' ? undefined : s.logo?.url,
                    url: typeof s === 'string' ? undefined : s.urlLink?.url
                }))
            });
        });
    });
    
    // Structure 2: indexed data with matches and tvChannels (used in matches-today page)
    Object.keys(pageData).forEach(key => {
        const group = pageData[key];
        if (group && group.matches && Array.isArray(group.matches)) {
            group.matches.forEach((match: any) => {
                let matchName = match.name;
                if (!matchName && match.teamA && match.teamB) {
                    matchName = `${match.teamA.name} ضد ${match.teamB.name}`;
                }
                
                const rawChannels = match.tvChannels || match.schedule || match.broadcasts || [];
                channelsData.push({
                    name: matchName,
                    startDate: match.startDate,
                    status: match.status,
                    url: match.link?.url || match.urlLink?.url,
                    channels: (Array.isArray(rawChannels) ? rawChannels : []).map((s: any) => ({
                        name: typeof s === 'string' ? s : s.name,
                        logo: typeof s === 'string' ? undefined : s.logo?.url,
                        url: typeof s === 'string' ? undefined : s.urlLink?.url
                    }))
                });
            });
        }
    });

    // Structure 3: direct matches array
    if (pageData.matches && Array.isArray(pageData.matches)) {
        pageData.matches.forEach((match: any) => {
            let matchName = match.name;
            if (!matchName && match.teamA && match.teamB) {
                matchName = `${match.teamA.name} ضد ${match.teamB.name}`;
            }
            
            const rawChannels = match.tvChannels || match.schedule || [];
            channelsData.push({
                name: matchName,
                startDate: match.startDate,
                status: match.status,
                url: match.link?.url || match.urlLink?.url,
                channels: (Array.isArray(rawChannels) ? rawChannels : []).map((s: any) => ({
                    name: typeof s === 'string' ? s : s.name,
                    logo: typeof s === 'string' ? undefined : s.logo?.url,
                    url: typeof s === 'string' ? undefined : s.urlLink?.url
                }))
            });
        });
    }
    
    return channelsData;
};

app.get("/api/kooora/channels", async (req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    try {
        const dateParam = req.query.date as string;
        const targetDate = dateParam ? dateParam.split('T')[0] : getMoroccanDateString(0);
        const teamA = req.query.teamA as string;
        const teamB = req.query.teamB as string;
        
        // Cache based on date primarily
        const EXTENDED_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours for stale data
        
        // 1. Check in-memory cache
        if (koooraCache[targetDate]) {
            const age = Date.now() - koooraCache[targetDate].timestamp;
            if (age < KOOORA_CACHE_TTL) {
                const data = koooraCache[targetDate].data;
                return res.json({ success: true, data, cached: true });
            }
        }

        // 2. Check Firestore persistent cache
        const fsCached = await getCachedData(`kooora_${targetDate}`, KOOORA_CACHE_TTL);
        if (fsCached) {
            koooraCache[targetDate] = { data: fsCached, timestamp: Date.now() };
            return res.json({ success: true, data: fsCached, cached: true });
        }

        // Try new API first - IMPORTANT: Always fetch the "global" date URL to ensure
        // max cache hits and prevent 429s from too many specific match requests.
        // Tracked under the shared "kooora" source along with the direct scrape below.
        const newApiUrl = `${BACKEND_BASE}/api/kooora/channels?date=${targetDate}`;

        const newData = await attemptSource('kooora', () => fetchWithDedupe(newApiUrl, 8000), (r) => !!r?.success);
        if (newData && newData.success) {
            console.log(`[API] Successfully fetched Kooora channels from new API for ${targetDate}`);
            koooraCache[targetDate] = { data: newData.data, timestamp: Date.now() };
            setCachedData(`kooora_${targetDate}`, newData.data).catch(err => console.error('[Cache] Save kooora failed:', err));
            return res.json(newData);
        }

        // If fetch failed but we have stale data, return it
        if (koooraCache[targetDate] && Date.now() - koooraCache[targetDate].timestamp < EXTENDED_CACHE_TTL) {
            console.log(`[API] Returning stale Kooora channels for ${targetDate} due to fetch failure`);
            return res.json({ success: true, data: koooraCache[targetDate].data, cached: true, stale: true });
        }

        const isToday = targetDate === getMoroccanDateString(0);
        const urlsToScrape = [];
        
        if (isToday) {
            // Detailed events page
            urlsToScrape.push('https://www.kooora.com/%D8%A3%D8%AD%D8%AF%D8%A7%D8%AB-%D8%B1%D9%8A%D8%A7%D8%B6%D9%8A%D8%A9/%D9%83%D8%B1%D8%A9-%D8%A7%D9%84%D9%82%D8%AF%D9%85');
            // Today's matches page (user requested)
            urlsToScrape.push('https://www.kooora.com/%D9%83%D8%B1%D8%A9-%D8%A7%D9%84%D9%82%D8%AF%D9%85/%D9%85%D8%A8%D8%A7%D8%B1%D9%8A%D8%A7%D8%AA-%D8%A7%D9%84%D9%82%D8%AF%D9%85');
        } else {
            const [year, month, day] = targetDate.split('-');
            urlsToScrape.push(`https://www.kooora.com/default.aspx?region=-1&area=0&dd=${parseInt(day)}&mm=${parseInt(month)}&yy=${year}`);
        }
        
        let allChannelsData: any[] = [];

        if (await isSourceEnabled('kooora') && breaker.canAttempt('kooora')) {
            for (const targetUrl of urlsToScrape) {
                try {
                    const html = await fetchWithStatus(targetUrl, 10000, 1);

                    if (html && typeof html === 'string') {
                        const cheerio = await import('cheerio');
                        const $ = cheerio.load(html);
                        const nextData = $('#__NEXT_DATA__').html();

                        if (nextData) {
                            const data = JSON.parse(nextData);
                            const parsed = parseKoooraData(data);
                            allChannelsData = allChannelsData.concat(parsed);
                        }
                    }
                } catch (e) {
                    console.error(`Error scraping ${targetUrl}:`, e);
                }
            }

            if (allChannelsData.length > 0) {
                breaker.recordSuccess('kooora');
            } else {
                breaker.recordFailure('kooora');
            }
        }

        // Deduplicate matches
        const seenMatches = new Set();
        const uniqueChannelsData = [];
        
        for (const match of allChannelsData) {
            const key = `${match.name}-${match.startDate}`;
            if (!seenMatches.has(key)) {
                seenMatches.add(key);
                uniqueChannelsData.push(match);
            }
        }

        // تخزين القنوات في ملف JSON
        try {
            await fs.writeFile(path.join(process.cwd(), "data", `channels-${targetDate}.json`), JSON.stringify(uniqueChannelsData, null, 2));
        } catch (e) {
            // Ignore write errors
        }

        koooraCache[targetDate] = { data: uniqueChannelsData, timestamp: Date.now() };
        setCachedData(`kooora_${targetDate}`, uniqueChannelsData).catch(err => console.error('[Cache] Save kooora scrape failed:', err));
        res.json({ success: true, data: uniqueChannelsData, cached: false });
    } catch (error: any) {
        console.error("Kooora scraping error:", error);
        res.status(500).json({ error: "Failed to fetch Kooora channels", details: error.message });
    }
});

// --- Admin panel API (server/adminAuth.ts gates every route below except login) ---

app.post("/api/admin/login", adminLoginLimiter, (req, res) => {
    if (!isAdminEnabled()) {
        return res.status(503).json({ error: "Admin panel disabled. Set ADMIN_PASSWORD on the server to enable it." });
    }
    const { password } = req.body || {};
    if (!checkPassword(password)) {
        return res.status(401).json({ error: "Invalid password" });
    }
    const { token, expiresAt } = createAdminToken();
    res.json({ token, expiresAt });
});

app.get("/api/admin/status", requireAdmin, async (req, res) => {
    const killSwitches: Record<string, boolean> = {};
    const map = await getKillSwitchMap();
    for (const source of KNOWN_SOURCES) {
        killSwitches[source] = map[source] !== false;
    }

    res.json({
        ...adminMetrics.getMetrics(),
        memoryCache: {
            matches: Object.entries(matchesCache).map(([key, v]) => ({ key, ageMs: Date.now() - v.timestamp, ttlMs: MATCHES_CACHE_TTL })),
        },
        circuitBreaker: breaker.getStatus(),
        killSwitches,
        settings: await getAdminSettings(),
    });
});

app.post("/api/admin/cache/clear", requireAdmin, (req, res) => {
    const { date } = req.body || {};
    if (date) {
        delete matchesCache[date];
    } else {
        for (const key of Object.keys(matchesCache)) delete matchesCache[key];
    }
    res.json({ success: true });
});

app.post("/api/admin/cache/refresh", requireAdmin, async (req, res) => {
    const { date } = req.body || {};
    if (!date) return res.status(400).json({ error: "date is required" });
    try {
        const data = await forceRefreshMatches(date);
        res.json({ success: true, data });
    } catch (e: any) {
        res.status(500).json({ error: "Refresh failed", details: e.message });
    }
});

app.get("/api/admin/sources", requireAdmin, async (req, res) => {
    const map = await getKillSwitchMap();
    const sources = KNOWN_SOURCES.map(source => ({ source, enabled: map[source] !== false }));
    res.json({ sources, circuitBreaker: breaker.getStatus() });
});

app.post("/api/admin/sources/:source", requireAdmin, async (req, res) => {
    const { enabled } = req.body || {};
    if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled (boolean) is required" });
    await setSourceEnabled(String(req.params.source), enabled);
    res.json({ success: true });
});

app.get("/api/admin/settings", requireAdmin, async (req, res) => {
    res.json(await getAdminSettings(true));
});

app.post("/api/admin/settings", requireAdmin, async (req, res) => {
    const { maintenanceMode, maintenanceMessage } = req.body || {};
    const patch: { maintenanceMode?: boolean; maintenanceMessage?: string } = {};
    if (typeof maintenanceMode === "boolean") patch.maintenanceMode = maintenanceMode;
    if (typeof maintenanceMessage === "string") patch.maintenanceMessage = maintenanceMessage;
    res.json(await updateAdminSettings(patch));
});

// The full, UN-filtered feed for a date (admin only) — includes matches an
// override or hiddenLeagues would hide from the public site, plus custom matches,
// so the operator can see and toggle everything.
app.get("/api/admin/raw-matches", requireAdmin, async (req, res) => {
    const date = req.query.date as string;
    if (!date) return res.status(400).json({ error: "Date parameter is required" });
    try {
        const payload = await resolveMatchesPayload(date);
        const settings = await getAdminSettings();
        return res.json(injectCustomMatches(payload, settings, date));
    } catch (e) {
        console.error(`[Admin] raw-matches error for ${date}:`, e);
        return res.json({ "STING-WEB-Matches": [] });
    }
});

app.post("/api/admin/overrides/match/:matchId", requireAdmin, async (req, res) => {
    const fields = req.body || {};
    res.json(await setMatchOverride(String(req.params.matchId), fields));
});

app.delete("/api/admin/overrides/match/:matchId", requireAdmin, async (req, res) => {
    res.json(await setMatchOverride(String(req.params.matchId), null));
});

// Hide (POST) / reveal (DELETE) a whole league on the public site.
app.post("/api/admin/overrides/league/:name", requireAdmin, async (req, res) => {
    try {
        res.json(await setLeagueHidden(decodeURIComponent(String(req.params.name)), true));
    } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed to hide league" });
    }
});

app.delete("/api/admin/overrides/league/:name", requireAdmin, async (req, res) => {
    try {
        res.json(await setLeagueHidden(decodeURIComponent(String(req.params.name)), false));
    } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed to reveal league" });
    }
});

// Force-show (POST) / stop force-showing (DELETE) a whole league on the public site.
app.post("/api/admin/overrides/league-show/:name", requireAdmin, async (req, res) => {
    try {
        res.json(await setLeagueShown(decodeURIComponent(String(req.params.name)), true));
    } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed to show league" });
    }
});

app.delete("/api/admin/overrides/league-show/:name", requireAdmin, async (req, res) => {
    try {
        res.json(await setLeagueShown(decodeURIComponent(String(req.params.name)), false));
    } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed to unshow league" });
    }
});

// --- Channels directory (admin-managed name/logo/link/servers) ---
app.get("/api/admin/channels", requireAdmin, async (_req, res) => {
    res.json(await getAdminChannels());
});

app.post("/api/admin/channels", requireAdmin, async (req, res) => {
    const list = Array.isArray(req.body?.channels) ? req.body.channels : req.body;
    res.json(await setAdminChannels(list));
});

// --- Custom (admin-created) matches ---
app.get("/api/admin/custom-matches", requireAdmin, async (_req, res) => {
    res.json((await getAdminSettings(true)).customMatches);
});

app.post("/api/admin/custom-match", requireAdmin, async (req, res) => {
    try {
        const settings = await setCustomMatch(req.body || {});
        const match = settings.customMatches.find(c => c.id === (req.body?.id)) || settings.customMatches[settings.customMatches.length - 1];
        res.json({ match, customMatches: settings.customMatches });
    } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed to save match" });
    }
});

app.delete("/api/admin/custom-match/:id", requireAdmin, async (req, res) => {
    const settings = await deleteCustomMatch(String(req.params.id));
    res.json({ customMatches: settings.customMatches });
});

// Re-serves a direct .m3u8 (and its segments/keys) with permissive CORS, for hosts that
// send no CORS headers or demand a same-site Referer. Only removes browser-side barriers
// — a dead upstream stays dead, and says so.
app.get("/api/hls", hlsLimiter, handleHlsProxy);

// --- Live stream section (Fabor-style watch page): admin-managed servers + promo banner ---

// Public: what the match page needs to render the live section. Per-match servers win
// over the global defaults; the promo banner is global.
app.get("/api/live-config", async (req, res) => {
    const matchId = String(req.query.matchId || "");
    const { liveConfig } = await getAdminSettings();
    const servers = (matchId && liveConfig.matchServers[matchId]) || liveConfig.defaultServers;
    res.setHeader("Cache-Control", "no-store");
    res.json({
        enabled: liveConfig.enabled,
        servers,
        overlayAd: liveConfig.overlayAd,
        logoUrl: liveConfig.logoUrl,
        bottomText: liveConfig.bottomText,
        logoTopPct: liveConfig.logoTopPct,
        logoRightPct: liveConfig.logoRightPct,
        logoSizePct: liveConfig.logoSizePct,
        logoBackdrop: liveConfig.logoBackdrop,
        logoPlacements: liveConfig.logoPlacements,
        hasMatchOverride: !!(matchId && liveConfig.matchServers[matchId]),
    });
});

app.get("/api/admin/live", requireAdmin, async (req, res) => {
    res.json((await getAdminSettings(true)).liveConfig);
});

// Patch enabled / defaultServers. Body is sanitized field-by-field.
app.post("/api/admin/live", requireAdmin, async (req, res) => {
    const body = req.body || {};
    const clean = sanitizeLiveConfig(body);
    const patch: any = {};
    if (typeof body.enabled === "boolean") patch.enabled = clean.enabled;
    if (Array.isArray(body.defaultServers)) patch.defaultServers = clean.defaultServers;
    if (body.overlayAd && typeof body.overlayAd === "object") patch.overlayAd = clean.overlayAd;
    if (typeof body.logoUrl === "string") patch.logoUrl = clean.logoUrl;
    if (typeof body.bottomText === "string") patch.bottomText = clean.bottomText;
    if (body.logoTopPct !== undefined) patch.logoTopPct = clean.logoTopPct;
    if (body.logoRightPct !== undefined) patch.logoRightPct = clean.logoRightPct;
    if (body.logoSizePct !== undefined) patch.logoSizePct = clean.logoSizePct;
    if (typeof body.logoBackdrop === "boolean") patch.logoBackdrop = clean.logoBackdrop;
    if (Array.isArray(body.logoPlacements)) patch.logoPlacements = clean.logoPlacements;
    res.json((await updateLiveConfig(patch)).liveConfig);
});

app.post("/api/admin/live/match/:matchId", requireAdmin, async (req, res) => {
    const { servers } = req.body || {};
    if (!Array.isArray(servers)) return res.status(400).json({ error: "servers (array) is required" });
    const clean = sanitizeLiveConfig({ matchServers: { m: servers } }).matchServers["m"] || [];
    res.json((await setMatchLiveServers(String(req.params.matchId), clean)).liveConfig);
});

app.delete("/api/admin/live/match/:matchId", requireAdmin, async (req, res) => {
    res.json((await setMatchLiveServers(String(req.params.matchId), null)).liveConfig);
});

// Import watch servers from a Fabor-TV page. Fetched through the proxy chain
// (fetchWithTimeout) since Fabor blocks direct server-side requests.
app.post("/api/admin/live/import-fabor", requireAdmin, async (req, res) => {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") return res.status(400).json({ error: "url (string) is required" });
    try {
        const servers = await importFaborServers(url, fetchWithTimeout);
        res.json({ servers });
    } catch (e: any) {
        res.status(502).json({ error: e?.message || "Fabor-TV import failed" });
    }
});

// Background Pre-warmer to keep cache fresh
const prewarmCache = async () => {
    const dates = [getMoroccanDateString(-1), getMoroccanDateString(0), getMoroccanDateString(1)];
    console.log(`[Cache] Pre-warming Matches, Kooora & LiveOnSat for: ${dates.join(', ')}`);
    
    for (const date of dates) {
        try {
            // 1. Pre-warm Matches (Main API)
            const matchUrl = `${BACKEND_BASE}/api/matches?date=${date}`;
            const matchData = await fetchWithTimeout(matchUrl, 8000);
            if (matchData && matchData["STING-WEB-Matches"]) {
                matchesCache[date] = { data: matchData, timestamp: Date.now() };
                setCachedData(`matches_${date}`, matchData).catch(() => {});
            }

            // 2. Pre-warm Kooora
            const koooraUrl = `${BACKEND_BASE}/api/kooora/channels?date=${date}`;
            const koooraData = await fetchWithTimeout(koooraUrl, 8000);
            if (koooraData && koooraData.success) {
                koooraCache[date] = { data: koooraData.data, timestamp: Date.now() };
                setCachedData(`kooora_${date}`, koooraData.data).catch(() => {});
            }
            
            // 3. Pre-warm LiveOnSat
            const losUrl = `${BACKEND_BASE}/api/liveonsat/channels?date=${date}`;
            const losData = await fetchWithTimeout(losUrl, 8000);
            if (losData) {
                setCachedData(`liveonsat_${date}`, losData).catch(() => {});
            }
            
        } catch (e) {
            console.error(`[Cache] Pre-warm failed for ${date}`, e);
        }
    }
};

app.get("/api/liveonsat/channels", async (req, res) => {
    try {
        const dateParam = req.query.date as string;
        const targetDate = dateParam ? dateParam.split('T')[0] : getMoroccanDateString(0);
        
        // Check Firestore first
        const fsCached = await getCachedData(`liveonsat_${targetDate}`, 60 * 60 * 1000); // 1-hour TTL
        if (fsCached) {
            return res.json(fsCached);
        }

        const apiUrl = `${BACKEND_BASE}/api/liveonsat/channels?date=${targetDate}`;
        const data = await fetchWithTimeout(apiUrl, 8000);
        if (data) {
            setCachedData(`liveonsat_${targetDate}`, data).catch(err => console.error('[Cache] Save liveonsat failed:', err));
            return res.json(data);
        }
    } catch (e) {
        console.error("Error fetching LiveOnSat channels:", e);
    }
    res.json({ success: false, data: [] });
});

// Tighter-interval companion to prewarmCache(): diffs today's cached matches for
// favorite-team push notifications. Reads whatever prewarmCache last put in matchesCache
// rather than fetching independently, so it never adds extra load on the upstream sources.
const checkPushTriggers = async () => {
    const today = getMoroccanDateString(0);
    const cached = matchesCache[today];
    if (!cached) return;
    try {
        await processMatchUpdates(cached.data);
    } catch (e) {
        console.error("[PushTriggers] Tick failed:", e);
    }
};

/* ---------------------------------------------------------------------------
 * GET /api/winwin/channels?date=YYYY-MM-DD
 *
 * Broadcasting channels for EVERY match of the day in one call. Mirrors the
 * WordPress theme's PHP implementation (inc/api-local.php) so the dev server
 * and production behave identically.
 *
 * winwin.com is the primary source: its schedule API returns matchChannels[]
 * (name + logo) per fixture. It only answers with real data when given the
 * compact date=YYYYMMDD plus a from/to UTC window covering the Morocco local
 * day — a plain date=YYYY-MM-DD silently returns a stale default set.
 * ------------------------------------------------------------------------- */

// Africa/Casablanca UTC offset (minutes) on a given day — Morocco shifts during Ramadan.
const casablancaOffsetMinutes = (dateISO: string): number => {
    try {
        const probe = new Date(`${dateISO}T12:00:00Z`);
        const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Casablanca', timeZoneName: 'longOffset' })
            .formatToParts(probe).find(p => p.type === 'timeZoneName')?.value || 'GMT+01:00';
        const m = name.match(/GMT([+-])(\d{2}):(\d{2})/);
        if (!m) return 60;
        return (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
    } catch { return 60; }
};

const buildWinwinUrl = (dateISO: string): string => {
    const [y, mo, d] = dateISO.split('-').map(Number);
    const offset = casablancaOffsetMinutes(dateISO);
    const fromMs = Date.UTC(y, mo - 1, d, 0, 0, 0) - offset * 60000;
    const toMs = fromMs + 24 * 60 * 60 * 1000;
    const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
    return 'https://www.winwin.com/api/component_data/match_landing_section/82053'
        + `?path=${encodeURIComponent('/matches')}&v=01`
        + `&date=${dateISO.replace(/-/g, '')}`
        + `&from=${encodeURIComponent(iso(fromMs))}`
        + `&to=${encodeURIComponent(iso(toMs))}`;
};

// Folds the letters Arabic sources swap when transliterating a Latin "g"
// (winwin writes "جامبا أوساكا", the match feed "غامبا أوساكا"), strips club
// noise ("إف سي"/FC) and collapses doubled letters so spellings converge.
const AR_FOLD: Record<string, string> = {
    'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ة': 'ه', 'ى': 'ي', 'ؤ': 'و', 'ئ': 'ي',
    'ک': 'ك', 'ی': 'ي', 'چ': 'غ', 'ج': 'غ', 'گ': 'غ', 'ڤ': 'ف', 'پ': 'ب',
};
const normalizeTeam = (input: string): string => {
    let s = String(input || '').replace(/[ً-ْـ]/g, '');
    s = s.replace(/[أإآٱةىؤئکیچجگڤپ]/g, ch => AR_FOLD[ch] || ch);
    s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    for (const noise of [' اف سي', 'اف سي ', ' اس سي', 'اس سي ']) s = s.split(noise).join(' ');
    s = s.replace(/(?<![a-z])(fc|sc|cf|ac)(?![a-z])/g, ' ').replace(/\s+/g, ' ').trim();
    return s.replace(/(.)\1+/gu, '$1');
};
// Generic football words are dropped so two unrelated clubs can't "match" on a
// shared suffix ("… يونايتد", "… سيتي").
const TEAM_STOPWORDS = new Set([
    'ال', 'نادي', 'فريق', 'fc', 'sc', 'cf', 'club', 'the',
    'يونايتد', 'سيتي', 'سبورت', 'سبورتينغ', 'سبورتنغ', 'اتلتيك', 'اتليتيك', 'اكاديميه',
]);
const teamTokens = (n: string) => n.split(' ').filter(t => t.length >= 3 && !TEAM_STOPWORDS.has(t));
// Loose containment only for distinctive strings: "نيك" (NEC) sits inside
// "باناثينيكوس" (Panathinaikos), which previously fused two different fixtures.
const strAkin = (x: string, y: string): boolean => {
    if (x === y) return true;
    if (Math.min(x.length, y.length) < 4) return false;
    return x.includes(y) || y.includes(x);
};
const teamsMatch = (a: string, b: string): boolean => {
    if (!a || !b) return false;
    if (strAkin(a, b)) return true;
    for (const x of teamTokens(a)) {
        for (const y of teamTokens(b)) {
            if (strAkin(x, y)) return true;
        }
    }
    return false;
};

// Kick-off as UTC "HH:MM" — a second matching signal for names spelled too
// differently (or written in Latin) between sources.
const kickoffUtc = (value?: string, offset?: string): string => {
    const s = String(value || '').trim();
    if (!s) return '';
    if (/^\d{1,2}:\d{2}$/.test(s)) {
        const [h, m] = s.split(':');
        return `${String(parseInt(h, 10)).padStart(2, '0')}:${m}`;
    }
    const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
    const d = new Date(hasZone ? s : (offset ? `${s}${offset}` : `${s}Z`));
    if (isNaN(d.getTime())) return '';
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

type ChannelEntry = { name: string; logo: string; url: string };
type CatalogRow = { src: string; a: string; b: string; channels: ChannelEntry[]; commentator: string; kickoff: string };

// Latin → Arabic club names, so sources that publish Latin names (liveonsat,
// the beIN EPG) can be matched against the Arabic match feed.
const LATIN_TO_AR: Record<string, string> = (() => {
    const norm = (t: string) => t.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\b(fc|sfc|sc|cf|ac|club|the)\b/g, ' ')
        .replace(/\s+/g, ' ').trim();
    const out: Record<string, string> = {};
    for (const [en, ar] of Object.entries(TEAM_TRANSLATIONS)) {
        const k = norm(en);
        if (k && !out[k]) out[k] = ar as string;
    }
    return out;
})();

const teamKey = (raw: string): string => {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (!/[؀-ۿ]/.test(s)) {
        const k = s.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\b(fc|sfc|sc|cf|ac|club|the)\b/g, ' ')
            .replace(/\s+/g, ' ').trim();
        if (LATIN_TO_AR[k]) return normalizeTeam(LATIN_TO_AR[k]);
    }
    return normalizeTeam(s);
};

const splitPairLabel = (label: string): [string, string] => {
    const parts = String(label || '').split(/\s+(?:ضد|في مواجهة|vs|v|x|×)\s+/i);
    return [teamKey(parts[0] || ''), teamKey(parts[1] || '')];
};

// "…: PSG vs Arsenal - Final" → [psg, arsenal]; null when not a fixture title.
const parseProgramTitle = (title: string): [string, string] | null => {
    let t = String(title || '');
    if (t.includes(':')) t = t.slice(t.indexOf(':') + 1);
    t = t.replace(/\s+-\s+[^-]*$/, '');
    if (!/\s(?:vs|v|ضد|×)\s/i.test(t)) return null;
    const [a, b] = splitPairLabel(t.trim());
    return (a && b) ? [a, b] : null;
};

const channelKey = (n: string) => String(n || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// Best unambiguous entry for a fixture within one source (see the PHP twin in
// inc/api-local.php): 2 points per matching side + 1 for an identical kick-off,
// accepted at >= 3, ties rejected rather than guessed.
const bestEntry = (catalog: CatalogRow[], src: string, a: string, b: string, kick: string): CatalogRow | null => {
    let best: CatalogRow | null = null;
    let score = 0;
    let tied = false;
    for (const e of catalog) {
        if (e.src !== src) continue;
        const direct = (teamsMatch(a, e.a) ? 1 : 0) + (teamsMatch(b, e.b) ? 1 : 0);
        const reverse = (teamsMatch(a, e.b) ? 1 : 0) + (teamsMatch(b, e.a) ? 1 : 0);
        const sides = Math.max(direct, reverse);
        if (!sides) continue;
        const s = sides * 2 + ((kick && e.kickoff === kick) ? 1 : 0);
        if (s > score) { score = s; best = e; tied = false; }
        else if (s === score && best) { tied = true; }
    }
    return (best && score >= 3 && !tied) ? best : null;
};

app.get("/api/winwin/channels", async (req, res) => {
    const raw = String(req.query.date || '');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getMoroccanDateString(0);
    res.set('Cache-Control', 'public, max-age=300');

    const result = await cachedJson(`winwin:${date}`, 300_000, async () => {
        // The day's fixtures (ids + Arabic team names + kick-off).
        const feed = await attemptSource(
            'yallamatch',
            () => fetchWithTimeout(`${BACKEND_BASE}/api/matches?date=${date}`, 12000),
            (r: any) => Array.isArray(r?.["STING-WEB-Matches"])
        );
        const matches: any[] = Array.isArray(feed?.["STING-WEB-Matches"]) ? feed["STING-WEB-Matches"] : [];
        if (matches.length === 0) return [];

        const catalog: CatalogRow[] = [];

        // --- Source 1 (primary): winwin.com ---
        try {
            const ww = await fetchWithTimeout(buildWinwinUrl(date), 14000);
            const groups: any[] = Array.isArray(ww?.b) ? ww.b : (Array.isArray(ww) ? ww : []);
            for (const g of groups) {
                for (const mm of (Array.isArray(g?.matches) ? g.matches : [])) {
                    if (!Array.isArray(mm?.matchChannels) || mm.matchChannels.length === 0) continue;
                    const t1 = mm?.team1?.name || '';
                    const t2 = mm?.team2?.name || '';
                    if (!t1 || !t2) continue;
                    const channels: ChannelEntry[] = [];
                    for (const c of mm.matchChannels) {
                        const name = (typeof c === 'string' ? c : (c?.name || c?.title || '')).toString().trim();
                        if (name) channels.push({ name, logo: (typeof c === 'object' && c?.logo) || '', url: '' });
                    }
                    if (channels.length) {
                        catalog.push({
                            src: 'winwin',
                            a: teamKey(t1), b: teamKey(t2), channels,
                            commentator: mm?.commentator || '',
                            kickoff: kickoffUtc(mm?.kickoffTime), // winwin publishes UTC
                        });
                    }
                }
            }
        } catch (e: any) {
            console.warn('[winwin] channels fetch failed:', e?.message || e);
        }

        // --- Source 2: kooora (kept warm in-process by prewarmCache) ---
        const koooraRows: any[] = Array.isArray(koooraCache[date]?.data) ? koooraCache[date].data : [];
        for (const row of koooraRows) {
            const channels: ChannelEntry[] = [];
            for (const c of (Array.isArray(row?.channels) ? row.channels : [])) {
                const name = (typeof c === 'string' ? c : (c?.name || '')).toString().trim();
                if (name) channels.push({ name, logo: (typeof c === 'object' && c?.logo) || '', url: (typeof c === 'object' && c?.url) || '' });
            }
            if (!channels.length) continue;
            const [a, b] = splitPairLabel(row?.name || '');
            if (a && b) catalog.push({ src: 'kooora', a, b, channels, commentator: row?.commentator || '', kickoff: kickoffUtc(row?.startDate) });
        }

        // --- Sources 3 & 4: liveonsat + the beIN EPG (Latin names; teamKey()
        // bridges them onto the Arabic feed via the app's club translations). ---
        const [losRes, beinRes] = await Promise.all([
            fetchWithTimeout(`${BACKEND_BASE}/api/liveonsat/channels?date=${date}`, 12000).catch(() => null),
            fetchWithTimeout(`${BACKEND_BASE}/api/bein-channels`, 14000).catch(() => null),
        ]);
        for (const row of (Array.isArray(losRes?.matches) ? losRes.matches : [])) {
            const channels: ChannelEntry[] = [];
            for (const c of (Array.isArray(row?.channels) ? row.channels : [])) {
                const name = (typeof c === 'string' ? c : (c?.name || '')).toString().trim();
                if (name) channels.push({ name, logo: '', url: '' });
            }
            if (!channels.length) continue;
            const [a, b] = splitPairLabel(row?.match || '');
            if (a && b) catalog.push({ src: 'los', a, b, channels, commentator: '', kickoff: kickoffUtc(row?.time) });
        }
        for (const chan of (Array.isArray(beinRes?.channels) ? beinRes.channels : [])) {
            const chanName = String(chan?.name || '').trim();
            if (!chanName) continue;
            for (const p of (Array.isArray(chan?.programs) ? chan.programs : [])) {
                const pair = parseProgramTitle(p?.title || '');
                if (!pair) continue;
                catalog.push({
                    src: 'bein', a: pair[0], b: pair[1],
                    channels: [{ name: chanName, logo: '', url: '' }],
                    commentator: '', kickoff: kickoffUtc(p?.start),
                });
            }
        }

        // --- Resolve each fixture against EVERY source and merge the hits, so a
        // match ends up with the union of what all four sources know about it.
        const SOURCE_ORDER = ['winwin', 'kooora', 'los', 'bein'];
        return matches.map((m: any) => {
            const aRaw = m?.["Team-Right"]?.Name || '';
            const bRaw = m?.["Team-Left"]?.Name || '';
            const a = teamKey(aRaw);
            const b = teamKey(bRaw);
            const kick = kickoffUtc(m?.["Time-Start"], m?.["Time-Zone"]);

            const channels: ChannelEntry[] = [];
            const seen = new Set<string>();
            let commentator = '';
            for (const src of SOURCE_ORDER) {
                const hit = bestEntry(catalog, src, a, b, kick);
                if (!hit) continue;
                for (const c of hit.channels) {
                    const key = channelKey(c.name);
                    if (!key || seen.has(key)) continue;
                    seen.add(key);
                    channels.push(c);
                }
                if (!commentator && hit.commentator) commentator = hit.commentator;
            }

            return {
                matchId: m?.["Match-id"] ?? null,
                name: `${aRaw} ضد ${bRaw}`.trim(),
                teamA: aRaw,
                teamB: bRaw,
                channels,
                commentator,
            };
        });
    });

    res.json({ success: true, data: Array.isArray(result) ? result : [] });
});

async function startServer() {
    // Run initial pre-warm
    prewarmCache().catch(console.error);
    // Interval for every 15 minutes
    setInterval(prewarmCache, 15 * 60 * 1000);

    // Interval for every 60 seconds
    setInterval(() => { checkPushTriggers().catch(console.error); }, 60 * 1000);

    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { 
                middlewareMode: true,
                hmr: false,
            },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        // Serve static files with efficient cache lifetimes
        app.use(express.static(distPath, {
            maxAge: '1y',
            immutable: true,
            index: false,
            setHeaders: (res, filePath) => {
                const fileName = path.basename(filePath);
                if (filePath.endsWith('.html') || fileName.endsWith('sw.js') || fileName === 'manifest.json') {
                    // Don't cache HTML files, service worker or manifest to ensure users always get the latest version
                    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                } else if (filePath.includes('/assets/') || filePath.match(/\.(js|css|woff2|png|jpg|jpeg|gif|svg|ico)$/)) {
                    // Assets like JS, CSS, and images are fingerprinted by Vite or are static, so they can be cached long-term
                    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                }
            }
        }));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'), {
                headers: {
                    'Cache-Control': 'public, max-age=0, must-revalidate'
                }
            });
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer().catch(err => {
    console.error("Failed to start server:", err);
});
