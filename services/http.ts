// Shared JSON fetch guard.
//
// Why this exists: several /api/* routes are served by a host that answers an
// unknown path with the SPA shell — HTTP 200, Content-Type text/html — instead
// of a 404. The old call sites all looked like:
//
//     const res = await fetch(url);
//     if (!res.ok) return [];        // passes: the soft-404 IS 200
//     return await res.json();       // throws on "<!doctype html>"
//
// so the throw was swallowed by the caller's catch and the feature rendered
// empty with no diagnostic. Checking the content type turns that silent
// degradation into an explicit, logged failure.

/** Thrown when a 200 response is not actually JSON (soft-404 / captive portal / error page). */
export class NotJsonError extends Error {
    readonly url: string;
    readonly contentType: string;

    constructor(url: string, contentType: string) {
        super(`Expected JSON from ${url} but got "${contentType || 'unknown'}" — the endpoint is probably not implemented on this host.`);
        this.name = 'NotJsonError';
        this.url = url;
        this.contentType = contentType;
    }
}

/**
 * Parse a Response as JSON, rejecting non-JSON 200s.
 * Throws NotJsonError rather than letting JSON.parse fail on an HTML body,
 * so callers can tell "endpoint missing" apart from "endpoint returned junk".
 */
export const parseJson = async <T>(res: Response): Promise<T> => {
    const contentType = res.headers.get('content-type') || '';
    if (!/\bapplication\/(\w+\+)?json\b/i.test(contentType)) {
        throw new NotJsonError(res.url, contentType);
    }
    return await res.json() as T;
};

/**
 * GET a JSON endpoint, returning `fallback` on any failure (network, non-2xx,
 * or a non-JSON body). The reason is logged once per call so a missing endpoint
 * is visible in the console instead of silently rendering an empty view.
 */
export const fetchJson = async <T>(url: string, fallback: T, init?: RequestInit): Promise<T> => {
    try {
        const res = await fetch(url, init);
        if (!res.ok) {
            console.warn(`[api] ${url} → HTTP ${res.status}`);
            return fallback;
        }
        return await parseJson<T>(res);
    } catch (error) {
        if (error instanceof NotJsonError) console.warn(`[api] ${error.message}`);
        else console.warn(`[api] ${url} failed:`, error);
        return fallback;
    }
};
