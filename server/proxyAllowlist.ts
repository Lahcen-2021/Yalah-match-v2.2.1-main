// Host allowlist for the server-side CORS proxy.
//
// A proxy that fetches whatever URL the caller names is an SSRF gadget: point it
// at http://169.254.169.254/ and it relays cloud-instance credentials back; point
// it at http://127.0.0.1:<port>/ and it reaches anything bound on the box. The
// WordPress port of this proxy has always had an allowlist
// (inc/api-local.php, yalla_local_proxy) - the Express one did not. This is that
// same curated list, kept in one place so the two stay in step.
//
// Only add a host here if the app genuinely needs to read it server-side.
export const PROXY_ALLOWED_HOSTS: ReadonlySet<string> = new Set([
    'webws.365scores.com', 'imagecache.365scores.com',
    'site.api.espn.com', 'sports.core.api.espn.com',
    'www.kooora.com', 'kooora.com', 'www.goalzz.com',
    'www.messisporat.com', 'messisporat.com',
    'liveonsat.com', 'www.liveonsat.com',
    'www.winwin.com', 'winwin.com', 'assets.winwin.com',
    'yallamatchapi-jdwel.pages.dev',
]);

/** True when `hostname` is allowed as a proxy target. Exact match, case-insensitive. */
export const isAllowedProxyHost = (hostname: string): boolean =>
    PROXY_ALLOWED_HOSTS.has(hostname.trim().toLowerCase());
