// Dynamic sitemap for the Netlify deployment.
//
// The Node server (server.ts `/sitemap.xml`) and the WordPress theme
// (functions.php `yalla_match_dynamic_sitemap`) both build this at request time so
// every match-detail URL is discoverable. Netlify had neither: it served the static
// `public/sitemap.xml`, which listed exactly ONE url (the homepage), so on the
// deployment that actually faces search engines nothing but "/" was submitted.
//
// This mirrors the other two implementations: the static routes the SPA really has,
// plus yesterday/today/tomorrow's fixtures resolved from the backend. Match slugs
// are date-stamped and rotate daily, which is precisely why this cannot be a
// build-time artifact.
import { generateMatchSlug } from "../../utils/translations";

const SITE = "https://www.yallamatch.online";
const API_BASE = process.env.VITE_API_BASE || "https://yallamatchapi-jdwel.pages.dev";

// Only routes App.tsx actually resolves. Competition pages are deliberately absent:
// the SPA has no per-competition route, so every such URL would render the same
// view — duplicate content, which costs more than the extra entries are worth.
const STATIC_PATHS = ["/", "/standings", "/tournaments", "/news", "/contact", "/privacy", "/terms"];

const moroccoDate = (offsetDays: number): string =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" })
        .format(new Date(Date.now() + offsetDays * 86_400_000));

const xmlEscape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default async (): Promise<Response> => {
    const urls = new Set(STATIC_PATHS.map(p => SITE + p));

    // A failed upstream must still yield a valid sitemap of the static routes rather
    // than a 500 — a broken sitemap is worse than a short one.
    await Promise.all([-1, 0, 1].map(async offset => {
        const date = moroccoDate(offset);
        try {
            const res = await fetch(`${API_BASE}/api/matches?date=${date}`, {
                signal: AbortSignal.timeout(8000),
            });
            if (!res.ok) return;
            const data: any = await res.json();
            for (const m of data?.["STING-WEB-Matches"] ?? []) {
                const home = m?.["Team-Right"]?.Name || "";
                const away = m?.["Team-Left"]?.Name || "";
                if (!home || !away) continue;
                urls.add(SITE + generateMatchSlug(home, away, m?.["Time-Start"] || date));
            }
        } catch (e) {
            console.warn(`[sitemap] ${date} unavailable:`, e);
        }
    }));

    const body =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        [...urls].map(u => `  <url><loc>${xmlEscape(u)}</loc></url>`).join("\n") +
        `\n</urlset>\n`;

    return new Response(body, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=1800",
        },
    });
};
