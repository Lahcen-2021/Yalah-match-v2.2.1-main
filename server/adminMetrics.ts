// Lightweight in-memory monitoring for the /admin panel. Intentionally process-local
// (no Firestore) — it's operational visibility for "is this instance healthy right now",
// not data that needs to survive a restart or be shared across instances.
const MAX_ERROR_LOG = 50;

const startedAt = Date.now();
const requestCounts: Record<string, number> = {};
const statusCounts: Record<string, number> = {}; // "2xx" | "4xx" | "5xx" etc.
const errorLog: { at: string; route: string; status: number; message?: string }[] = [];
const lastScrapeAt: Record<string, string> = {};

export function recordRequest(route: string, status: number): void {
    requestCounts[route] = (requestCounts[route] || 0) + 1;
    const bucket = `${Math.floor(status / 100)}xx`;
    statusCounts[bucket] = (statusCounts[bucket] || 0) + 1;
    if (status >= 400) {
        errorLog.unshift({ at: new Date().toISOString(), route, status });
        errorLog.length = Math.min(errorLog.length, MAX_ERROR_LOG);
    }
}

export function recordScrape(source: string): void {
    lastScrapeAt[source] = new Date().toISOString();
}

export function getMetrics() {
    return {
        uptimeMs: Date.now() - startedAt,
        startedAt: new Date(startedAt).toISOString(),
        requestCounts,
        statusCounts,
        recentErrors: errorLog,
        lastScrapeAt,
    };
}
