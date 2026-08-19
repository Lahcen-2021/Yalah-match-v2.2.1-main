// Shared stream/channel URL hygiene, used by the admin (on save), the server
// sanitizers, and the live player. Two jobs:
//   1. cleanStreamUrl — strip ad/tracker params and unwrap ad-redirect wrappers.
//   2. isAdHost — recognise known ad / popunder / tracker hosts so the player can
//      refuse to load them.
// Importable from both the browser bundle and the Node server (no DOM deps).

// Known ad / tracker / popunder host fragments injected by free streaming embeds.
const AD_HOST_PATTERNS = [
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'google-analytics.com',
    'adservice.google', 'popads.net', 'popcash.net', 'propellerads', 'propellerclick',
    'popunder', 'a-ads.com', 'adsterra', 'adsterr', 'exoclick.com', 'exosrv.com',
    'juicyads.com', 'trafficjunky', 'hilltopads', 'hilltop', 'clickadu', 'adnium',
    'adnxs.com', 'mgid.com', 'revcontent.com', 'taboola.com', 'outbrain.com',
    'onclickads', 'onclckds', 'bidgear', 'ad-maven', 'admaven', 'adcash',
    'clickfuse', 'yllix', 'monetiz', 'popttx', 'poptm', 'clkmon', 'servedby',
];

// True when the URL's host looks like a known ad / tracker / popunder host.
export function isAdHost(rawUrl: string): boolean {
    try {
        const host = new URL(rawUrl).hostname.toLowerCase();
        return AD_HOST_PATTERNS.some(p => host.includes(p));
    } catch {
        return false;
    }
}

// Exact ad/tracking query keys to strip (utm_* is handled by prefix separately).
const TRACKING_KEYS = new Set([
    'gclid', 'fbclid', 'msclkid', 'dclid', 'yclid', 'twclid', 'igshid', 'mc_eid', 'mc_cid',
    'ad', 'ads', 'adid', 'ad_id', 'adset', 'adgroup', 'campaign', 'campaignid', 'campaign_id',
    'aff', 'affid', 'affiliate', 'affiliate_id', 'click', 'clickid', 'click_id', 'clk',
    'promo', 'promoid', 'partner', 'partnerid', 'pk_campaign', 'pk_kwd',
]);

// Params that wrap a real destination URL (ad interstitials / redirectors).
const REDIRECT_KEYS = ['url', 'u', 'redirect', 'redirect_url', 'redirecturl', 'r', 'to', 'target', 'dest', 'destination', 'out', 'goto', 'continue'];

// Remove ad/tracking params and follow ad-redirect wrappers to the real stream URL.
// Functional params (stream, id, channel, token…) are always kept. Never throws —
// returns the input unchanged if it isn't a parseable absolute URL.
export function cleanStreamUrl(raw: string): string {
    const input = (raw || '').trim();
    if (!input) return '';
    let url: URL;
    try {
        url = new URL(input);
    } catch {
        return input;
    }

    // Unwrap ad/redirect wrappers that carry the real http(s) URL (bounded depth).
    for (let depth = 0; depth < 3; depth++) {
        let unwrapped = false;
        for (const key of REDIRECT_KEYS) {
            const val = url.searchParams.get(key);
            if (!val) continue;
            let candidate = val;
            try { candidate = decodeURIComponent(val); } catch { /* keep raw */ }
            if (/^https?:\/\//i.test(candidate)) {
                try { url = new URL(candidate); unwrapped = true; break; } catch { /* ignore */ }
            }
        }
        if (!unwrapped) break;
    }

    // Drop tracking/ad params (exact matches + any utm_* prefix); keep the rest.
    const kept = new URLSearchParams();
    for (const [k, v] of url.searchParams.entries()) {
        const key = k.toLowerCase();
        if (key.startsWith('utm_') || TRACKING_KEYS.has(key)) continue;
        kept.set(k, v);
    }
    const qs = kept.toString();
    url.search = qs ? `?${qs}` : '';
    return url.toString();
}
