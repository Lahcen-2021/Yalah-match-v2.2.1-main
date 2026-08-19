// Imports watch-server links from a Fabor-TV match/embed page for the admin Live tab.
// Fabor-TV blocks direct server-side requests (Cloudflare 403), so the fetch is routed
// through the caller-provided rotating fetcher (the same proxy chain server.ts uses for
// its other scrapers), which fetches via a public CORS proxy that bypasses the block.
import type { LiveStreamServer } from "./adminSettings.ts";

export type Fetcher = (url: string, timeoutMs?: number) => Promise<any>;

// Language hints → tab label + flag, so imported servers come out labelled like the
// reference (AR 1, AR 2, FR, EN) instead of "Server 1/2/3".
const LANG_LABELS: { re: RegExp; label: string; flag: string }[] = [
    { re: /\bar[\s_-]*1\b|arabic[\s_-]*1|ar1/i, label: "AR 1", flag: "🇲🇦" },
    { re: /\bar[\s_-]*2\b|arabic[\s_-]*2|ar2/i, label: "AR 2", flag: "🇲🇦" },
    { re: /\bar[\s_-]*3\b|ar3/i, label: "AR 3", flag: "🇲🇦" },
    { re: /\bfr\b|french|france/i, label: "FR", flag: "🇫🇷" },
    { re: /\ben\b|english|\buk\b/i, label: "EN", flag: "🇬🇧" },
    { re: /\bes\b|spanish|espanol|españ(o|ó)l/i, label: "ES", flag: "🇪🇸" },
    { re: /\bde\b|german|deutsch/i, label: "DE", flag: "🇩🇪" },
    { re: /\bit\b|italian|italiano/i, label: "IT", flag: "🇮🇹" },
    { re: /\bpt\b|portug/i, label: "PT", flag: "🇵🇹" },
];

function labelFor(context: string, index: number): { label: string; flag: string } {
    for (const l of LANG_LABELS) {
        if (l.re.test(context)) return { label: l.label, flag: l.flag };
    }
    return { label: `Server ${index + 1}`, flag: "" };
}

// Absolutise a possibly-relative URL against the page it was found on.
function absolutise(raw: string, base: string): string {
    try {
        return new URL(raw, base).toString();
    } catch {
        return raw;
    }
}

function dedupe(servers: LiveStreamServer[]): LiveStreamServer[] {
    const seen = new Set<string>();
    const out: LiveStreamServer[] = [];
    for (const s of servers) {
        if (seen.has(s.url)) continue;
        seen.add(s.url);
        out.push(s);
    }
    return out;
}

// Pull stream sources out of a Fabor page's HTML/JS. Handles the common patterns a
// bundled HLS player leaves behind: raw .m3u8 URLs, "file"/"src"/"source" JSON fields,
// data-* attributes, and nested <iframe> embeds.
export function parseFaborServers(html: string, pageUrl: string): LiveStreamServer[] {
    if (!html || typeof html !== "string") return [];
    const found: { url: string; type: "iframe" | "hls"; ctx: string }[] = [];

    const push = (url: string, type: "iframe" | "hls", ctx: string) => {
        const clean = url.replace(/\\\//g, "/").replace(/&amp;/g, "&").trim();
        if (!clean || clean.length < 8) return;
        if (/^data:|^javascript:|\.(png|jpe?g|gif|svg|webp|css|woff2?)($|\?)/i.test(clean)) return;
        found.push({ url: absolutise(clean, pageUrl), type, ctx });
    };

    // Narrow window so a language label (AR 1 / FR …) is only picked up from the text
    // immediately wrapping this source, not the previous entry a few tokens earlier.
    const near = (idx: number, after = 12) => html.slice(Math.max(0, idx - 40), idx + after);

    // 1. Direct HLS manifests anywhere in the markup/scripts.
    const m3u8Re = /https?:\\?\/\\?\/[^\s"'`<>]+?\.m3u8[^\s"'`<>]*/gi;
    for (const m of html.matchAll(m3u8Re)) {
        push(m[0], "hls", near(m.index ?? 0));
    }

    // 2. Player config fields: file:"...", src:'...', "source":"...", data-src="...".
    const fieldRe = /(?:file|src|source|url|hls|stream)\s*[:=]\s*["']([^"']+\.m3u8[^"']*)["']/gi;
    for (const m of html.matchAll(fieldRe)) {
        push(m[1], "hls", near(m.index ?? 0));
    }

    // 3. Nested iframe embeds (a Fabor page may wrap each language in its own embed).
    const iframeRe = /<iframe[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi;
    for (const m of html.matchAll(iframeRe)) {
        const url = m[1];
        if (/about:blank|^#|ads?\.|doubleclick|google/i.test(url)) continue;
        push(url, "iframe", near(m.index ?? 0, m[0].length));
    }

    const deduped = dedupe(
        found.map(({ url, type, ctx }, i) => {
            const { label, flag } = labelFor(ctx + " " + url, i);
            return {
                id: `fabor-${i}-${Math.random().toString(36).slice(2, 7)}`,
                label,
                flag,
                url,
                type,
            } as LiveStreamServer;
        })
    );

    // Renumber generic "Server N" labels after dedupe so they stay 1..N.
    let generic = 0;
    return deduped.map((s) => (/^Server \d+$/.test(s.label) ? { ...s, label: `Server ${++generic}` } : s));
}

// Fetch a Fabor-TV page through the proxy chain and extract its watch servers.
export async function importFaborServers(pageUrl: string, fetcher: Fetcher): Promise<LiveStreamServer[]> {
    let parsed: URL;
    try {
        parsed = new URL(pageUrl);
    } catch {
        throw new Error("Invalid URL");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("URL must be http(s)");
    }
    // Any channel/embed page is accepted (not just Fabor-TV): we scrape it for a direct
    // .m3u8 so the stream can play in our own ad-free player. FABOR_HOST_RE is kept only
    // to prefer the proxy path Fabor needs; other hosts fetch directly first.

    const data = await fetcher(pageUrl, 15000);
    const html = typeof data === "string" ? data : JSON.stringify(data ?? "");
    if (!html) throw new Error("The page could not be fetched (blocked or offline)");

    const servers = parseFaborServers(html, pageUrl);
    if (servers.length === 0) {
        // Fall back to embedding the page itself as a single iframe server so the operator
        // still gets a usable stream even when direct-link extraction finds nothing.
        return [{ id: `embed-${Date.now()}`, label: "Embed", flag: "📺", url: pageUrl, type: "iframe" }];
    }
    // Direct HLS first — those play in our own player without the source page's overlay ads.
    servers.sort((a, b) => (a.type === "hls" ? 0 : 1) - (b.type === "hls" ? 0 : 1));
    return servers.slice(0, 12);
}
