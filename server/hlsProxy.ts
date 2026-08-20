// Local HLS proxy: /api/hls?url=<absolute stream url>
//
// Some stream hosts serve a perfectly good .m3u8 but send no CORS headers, or reject
// requests that don't carry a Referer from their own site. A browser can't work around
// either, so hls.js fails even though the stream is alive. Fetching server-side and
// re-serving with permissive CORS sidesteps both.
//
// This CANNOT revive a dead stream — if the origin 404s or serves HTML instead of a
// playlist, the proxy faithfully reports that. It only removes browser-side barriers to
// a stream that is actually up.
import type { Request, Response } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import dns from "node:dns/promises";
import net from "node:net";

// `Response` in this file is Express's (imported above), so the global fetch
// Response has to be referred to by a distinct name.
type FetchResponse = Awaited<ReturnType<typeof fetch>>;

// A proxy that fetches any URL the caller names is an SSRF gadget: without this it could
// be pointed at cloud metadata endpoints or services on the private network and made to
// relay the response back. Only public hosts are allowed through.
export function isPrivateAddress(ip: string): boolean {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split(".").map(Number);
        return (
            a === 0 || a === 10 || a === 127 ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 192 && b === 0) ||            // 192.0.0.0/24 IETF protocol assignments
            (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 benchmarking
            (a === 169 && b === 254) ||          // link-local (cloud metadata)
            (a === 100 && b >= 64 && b <= 127) ||// carrier-grade NAT
            a >= 224                              // multicast / reserved
        );
    }
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    // IPv4-mapped IPv6, dotted form (::ffff:10.0.0.1) — unwrap and re-check.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateAddress(mapped[1]);
    // IPv4-mapped IPv6, hex form (::ffff:7f00:1 === 127.0.0.1). The dotted regex
    // above misses this spelling, which is a valid way to write loopback.
    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
    if (hex) {
        const n = (parseInt(hex[1], 16) << 16) | parseInt(hex[2], 16);
        return isPrivateAddress([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."));
    }
    return false;
}

export async function assertPublicHost(hostname: string): Promise<void> {
    if (net.isIP(hostname)) {
        if (isPrivateAddress(hostname)) throw new Error("blocked host");
        return;
    }
    const records = await dns.lookup(hostname, { all: true });
    if (records.length === 0 || records.some(r => isPrivateAddress(r.address))) {
        throw new Error("blocked host");
    }
}

export function parseTarget(raw: unknown): URL {
    const url = new URL(String(raw || ""));
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("bad protocol");
    return url;
}

/**
 * fetch() that re-validates every hop instead of trusting the first one.
 *
 * assertPublicHost() only ever saw the URL the caller supplied. With
 * `redirect: "follow"` an allowed public host could answer 302 -> 169.254.169.254
 * and the guard was bypassed entirely, because redirects are resolved inside
 * fetch where nothing re-checks them. Following manually puts the check back on
 * every hop. `extraCheck` lets the caller also re-assert a host allowlist.
 */
export async function fetchGuarded(
    target: URL,
    init: RequestInit,
    { maxRedirects = 5, extraCheck }: { maxRedirects?: number; extraCheck?: (url: URL) => void } = {},
): Promise<FetchResponse> {
    let current = target;
    for (let hop = 0; hop <= maxRedirects; hop++) {
        extraCheck?.(current);
        await assertPublicHost(current.hostname);

        const response = await fetch(current.toString(), { ...init, redirect: "manual" });
        const isRedirect = response.status >= 300 && response.status < 400 && response.headers.has("location");
        if (!isRedirect) return response;

        const next = new URL(response.headers.get("location")!, current);
        if (next.protocol !== "http:" && next.protocol !== "https:") throw new Error("bad protocol");
        current = next;
    }
    throw new Error("too many redirects");
}

const BROWSER_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Wrap an absolute URL back into a proxy URL, so every hop of the stream (variant
// playlists, segments, encryption keys) is fetched through us too. Rewriting only the
// top-level playlist would leave the segments to be fetched cross-origin and blocked.
function toProxyUrl(absolute: string): string {
    return `/api/hls?url=${encodeURIComponent(absolute)}`;
}

// Rewrite every URI in a playlist to point back at this proxy.
export function rewritePlaylist(body: string, baseUrl: string): string {
    const abs = (ref: string) => {
        try { return new URL(ref, baseUrl).toString(); } catch { return ref; }
    };
    return body.split(/\r?\n/).map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        if (trimmed.startsWith("#")) {
            // Tags carrying a URI attribute: EXT-X-KEY, EXT-X-MEDIA, EXT-X-MAP, …
            return line.replace(/URI="([^"]+)"/g, (_m, ref) => `URI="${toProxyUrl(abs(ref))}"`);
        }
        // A bare line is a segment or variant playlist reference.
        return toProxyUrl(abs(trimmed));
    }).join("\n");
}

function looksLikePlaylist(contentType: string, body: string): boolean {
    return /mpegurl/i.test(contentType) || body.trimStart().startsWith("#EXTM3U");
}

export async function handleHlsProxy(req: Request, res: Response): Promise<void> {
    let target: URL;
    try {
        target = parseTarget(req.query.url);
        await assertPublicHost(target.hostname);
    } catch {
        res.status(400).json({ error: "A valid public http(s) `url` is required" });
        return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    // Client hangs up (viewer switches server, closes the tab) — stop pulling upstream.
    // Only while the response is still open: once it has completed normally, Express also
    // emits close, and aborting then would error a finished stream.
    const abortIfUnfinished = () => { if (!res.writableEnded) controller.abort(); };
    req.on("close", abortIfUnfinished);

    try {
        // fetchGuarded, not fetch: every redirect hop is re-checked against
        // assertPublicHost, so an allowed host cannot bounce us to the metadata
        // endpoint or onto the private network.
        const upstream = await fetchGuarded(target, {
            signal: controller.signal,
            headers: {
                "User-Agent": BROWSER_UA,
                // Many stream hosts allow only requests that look like they came from
                // their own player page, so present their origin as the referrer.
                "Referer": `${target.origin}/`,
                "Origin": target.origin,
                "Accept": "*/*",
                ...(req.headers.range ? { Range: String(req.headers.range) } : {}),
            },
        });

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cache-Control", "no-store");

        if (!upstream.ok) {
            res.status(upstream.status).json({ error: `Upstream responded ${upstream.status}` });
            return;
        }

        const contentType = upstream.headers.get("content-type") || "";

        // Playlists are small, so buffering to rewrite them costs nothing. Segments are
        // large and must be streamed rather than held in memory.
        if (/mpegurl/i.test(contentType) || /\.m3u8(\?|$)/i.test(target.pathname + target.search)) {
            const body = await upstream.text();
            if (!looksLikePlaylist(contentType, body)) {
                // An HTML error/consent page dressed up as a stream — surface it plainly
                // instead of handing the player something it will choke on.
                res.status(502).json({ error: "Upstream did not return a playlist", contentType });
                return;
            }
            res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
            res.status(200).send(rewritePlaylist(body, upstream.url || target.toString()));
            return;
        }

        if (contentType) res.setHeader("Content-Type", contentType);
        const length = upstream.headers.get("content-length");
        if (length) res.setHeader("Content-Length", length);
        res.status(upstream.status);
        if (!upstream.body) {
            res.end();
            return;
        }
        // pipeline (not .pipe) so an upstream stall or a viewer disconnecting mid-segment
        // rejects here and tears both ends down, instead of surfacing as an unhandled
        // stream 'error' event — which would take the whole server process down.
        await pipeline(Readable.fromWeb(upstream.body as any), res);
    } catch (e: any) {
        // Headers already sent means we died mid-segment; the socket is the only signal
        // left, so just close it rather than trying to write an error body.
        if (res.headersSent) {
            res.destroy();
        } else if (controller.signal.aborted) {
            res.status(504).json({ error: "Upstream timed out" });
        } else {
            res.status(502).json({ error: e?.message || "Upstream fetch failed" });
        }
    } finally {
        clearTimeout(timeout);
        req.off("close", abortIfUnfinished);
    }
}
