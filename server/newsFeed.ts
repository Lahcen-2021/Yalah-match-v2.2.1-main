// Football news aggregator: pulls a set of RSS feeds (Arabic-native + English),
// normalizes items, and translates the English ones to Arabic with Gemini when
// GEMINI_API_KEY is set (they are served untranslated otherwise, so the feature
// degrades gracefully instead of breaking without the key).
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";
import { buildTranslatePrompt, TRANSLATE_MODEL, type TranslatePayloadItem } from "./translatePrompt.ts";

export interface NewsItem {
    id: string;
    title: string;
    description: string;
    link: string;
    source: string;
    imageUrl: string;
    publishedAt: string; // ISO-8601
    translated: boolean;
}

interface FeedConfig {
    source: string;
    url: string;
    lang: "ar" | "en";
}

const FEEDS: FeedConfig[] = [
    { source: "CNN بالعربية", url: "https://arabic.cnn.com/api/v1/rss/sport/rss.xml", lang: "ar" },
    { source: "بي بي سي", url: "https://feeds.bbci.co.uk/sport/football/rss.xml", lang: "en" },
    { source: "سكاي سبورتس", url: "https://www.skysports.com/rss/11095", lang: "en" },
    { source: "ESPN", url: "https://www.espn.com/espn/rss/soccer/news", lang: "en" },
];

const MAX_ITEMS_PER_FEED = 12;
const MAX_TOTAL_ITEMS = 36;

// Translation memo keyed by article link, so items already translated in a previous
// refresh are never re-sent to Gemini (feeds mostly overlap between refreshes).
const TRANSLATION_MEMO_MAX = 1000;
const translationMemo = new Map<string, { title: string; description: string }>();

const fetchXml = async (url: string, timeout = 10000): Promise<string | null> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/rss+xml, application/xml, text/xml, */*",
            },
        });
        if (!response.ok) return null;
        return await response.text();
    } catch {
        return null;
    } finally {
        clearTimeout(id);
    }
};

const stripHtml = (html: string): string =>
    cheerio.load(`<div>${html}</div>`)("div").text().replace(/\s+/g, " ").trim();

// JS Date() rejects timezone abbreviations some feeds use (Sky ships "BST"),
// so translate the common ones to numeric offsets before parsing.
const TZ_ABBREVIATIONS: Record<string, string> = {
    BST: "+0100", GMT: "+0000", UT: "+0000", CET: "+0100", CEST: "+0200",
    EST: "-0500", EDT: "-0400", CST: "-0600", CDT: "-0500", PST: "-0800", PDT: "-0700",
};

const parsePubDate = (raw: string): Date => {
    if (!raw) return new Date();
    let candidate = raw.trim();
    const direct = new Date(candidate);
    if (!isNaN(direct.getTime())) return direct;
    candidate = candidate.replace(/\b([A-Z]{2,4})\s*$/, (m, abbr) => TZ_ABBREVIATIONS[abbr] ?? m);
    const fixed = new Date(candidate);
    return isNaN(fixed.getTime()) ? new Date() : fixed;
};

const parseFeed = (xml: string, feed: FeedConfig): (NewsItem & { lang: string })[] => {
    const $ = cheerio.load(xml, { xmlMode: true });
    const items: (NewsItem & { lang: string })[] = [];

    $("item").each((_, el) => {
        if (items.length >= MAX_ITEMS_PER_FEED) return false;
        const $el = $(el);
        const link = $el.find("link").first().text().trim() || $el.find("guid").first().text().trim();
        const title = stripHtml($el.find("title").first().text());
        if (!link || !title) return;

        const description = stripHtml($el.find("description").first().text()).slice(0, 300);
        const parsedDate = parsePubDate($el.find("pubDate").first().text());

        // Try the common RSS image carriers in order.
        const imageUrl =
            $el.find("media\\:thumbnail").attr("url") ||
            $el.find("media\\:content").attr("url") ||
            $el.find("enclosure[type^='image']").attr("url") ||
            "";

        items.push({
            id: link,
            title,
            description,
            link,
            source: feed.source,
            imageUrl,
            publishedAt: parsedDate.toISOString(),
            translated: feed.lang === "ar",
            lang: feed.lang,
        });
    });

    return items;
};

// --- Translation providers -------------------------------------------------
// Both return the raw [{ i, t, d }] translations array, or null on failure so
// the chain can move on to the next provider.

// Preferred: the site's own Netlify Function (netlify/functions/translate-news.mts),
// which calls Gemini through the Netlify AI Gateway — no API key to provision here.
// TRANSLATE_ENDPOINT e.g. https://www.yallamatch.online/translate-news
const translateViaGateway = async (payload: TranslatePayloadItem[]): Promise<any[] | null> => {
    const endpoint = process.env.TRANSLATE_ENDPOINT;
    if (!endpoint) return null;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 20000);
    try {
        const res = await fetch(endpoint, {
            method: "POST",
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                ...(process.env.TRANSLATE_SECRET ? { "x-translate-secret": process.env.TRANSLATE_SECRET } : {}),
            },
            body: JSON.stringify({ items: payload }),
        });
        if (!res.ok) {
            console.warn(`[News] Gateway translation endpoint returned ${res.status}`);
            return null;
        }
        const translations = await res.json();
        return Array.isArray(translations) ? translations : null;
    } catch (e) {
        console.warn("[News] Gateway translation failed:", (e as Error).message);
        return null;
    } finally {
        clearTimeout(id);
    }
};

// Fallback: direct Gemini call with a locally provisioned GEMINI_API_KEY.
const translateViaGemini = async (payload: TranslatePayloadItem[]): Promise<any[] | null> => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: TRANSLATE_MODEL,
            contents: buildTranslatePrompt(payload),
            config: { responseMimeType: "application/json", temperature: 0.2 },
        });
        const translations = JSON.parse(response.text || "[]");
        return Array.isArray(translations) ? translations : null;
    } catch (e) {
        console.warn("[News] Direct Gemini translation failed:", (e as Error).message);
        return null;
    }
};

// Keyless fallback: Google's public translate endpoint. Needs no API key, so news
// translates out of the box; quality/reliability is below Gemini, so it runs only
// after the configured providers. Set NEWS_TRANSLATE_FREE=off to disable it.
const GOOGLE_TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=";
const FREE_BATCH_CHARS = 1200;

// Translates one text; used as the per-line fallback when a batch loses alignment.
const googleTranslateOne = async (text: string): Promise<string | null> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 12000);
    try {
        const res = await fetch(GOOGLE_TRANSLATE_URL + encodeURIComponent(text), {
            signal: controller.signal,
            headers: { "User-Agent": "Mozilla/5.0" },
        });
        if (!res.ok) return null;
        const data = await res.json();
        const segs = Array.isArray(data?.[0]) ? data[0] : [];
        return segs.map((s: any) => (Array.isArray(s) ? s[0] : "")).join("");
    } catch {
        return null;
    } finally {
        clearTimeout(id);
    }
};

// Translates a list of single-line texts, preserving order/count. Batches lines
// newline-joined (the endpoint keeps the newlines); on a rare alignment mismatch,
// retries that batch one line at a time so the whole set never fails together.
const googleTranslateLines = async (lines: string[]): Promise<string[] | null> => {
    const results: string[] = [];
    let batch: string[] = [];
    let batchLen = 0;

    const flush = async (): Promise<boolean> => {
        if (batch.length === 0) return true;
        const current = batch;
        batch = [];
        batchLen = 0;

        if (current.length === 1) {
            const one = await googleTranslateOne(current[0]);
            if (one === null) return false;
            results.push(one);
            return true;
        }

        const joined = await googleTranslateOne(current.join("\n"));
        const parts = joined?.split("\n");
        if (parts && parts.length === current.length) {
            results.push(...parts);
            return true;
        }
        // Alignment lost — translate this batch line by line.
        for (const line of current) {
            const one = await googleTranslateOne(line);
            if (one === null) return false;
            results.push(one);
        }
        return true;
    };

    for (const line of lines) {
        const clean = line.replace(/\s*\n\s*/g, " ").trim();
        if (batchLen + clean.length > FREE_BATCH_CHARS && batch.length > 0) {
            if (!(await flush())) return null;
        }
        batch.push(clean);
        batchLen += clean.length + 1;
    }
    if (!(await flush())) return null;

    return results.length === lines.length ? results : null;
};

const translateViaFreeApi = async (payload: TranslatePayloadItem[]): Promise<any[] | null> => {
    if (process.env.NEWS_TRANSLATE_FREE === "off") return null;

    // Flatten titles + non-empty descriptions into a line list, remembering where
    // each line came from so translations can be mapped back.
    const lines: string[] = [];
    const refs: { idx: number; field: "t" | "d" }[] = [];
    payload.forEach((it, idx) => {
        if (it.t) { lines.push(it.t); refs.push({ idx, field: "t" }); }
        if (it.d) { lines.push(it.d); refs.push({ idx, field: "d" }); }
    });
    if (lines.length === 0) return null;

    let translated: string[] | null;
    try {
        translated = await googleTranslateLines(lines);
    } catch (e) {
        console.warn("[News] Free translation failed:", (e as Error).message);
        return null;
    }
    if (!translated) return null;

    const out = payload.map(it => ({ i: it.i, t: it.t, d: it.d }));
    translated.forEach((text, li) => {
        const ref = refs[li];
        if (ref && text) out[ref.idx][ref.field] = text;
    });
    return out;
};

// Provider chain shared by list translation and article translation:
// Netlify AI Gateway → direct Gemini key → keyless Google endpoint.
const translateBatch = async (payload: TranslatePayloadItem[]): Promise<any[] | null> =>
    (await translateViaGateway(payload)) ??
    (await translateViaGemini(payload)) ??
    (await translateViaFreeApi(payload));

// Translates English items to Arabic: Netlify AI Gateway function first, then a
// direct Gemini key, otherwise items are served untranslated.
const translateToArabic = async (items: (NewsItem & { lang: string })[]): Promise<void> => {
    const pending = items.filter(it => it.lang === "en" && !it.translated);
    if (pending.length === 0) return;

    // Serve memoized translations first.
    const toTranslate: (NewsItem & { lang: string })[] = [];
    for (const item of pending) {
        const memo = translationMemo.get(item.link);
        if (memo) {
            item.title = memo.title;
            item.description = memo.description;
            item.translated = true;
        } else {
            toTranslate.push(item);
        }
    }
    if (toTranslate.length === 0) return;

    const payload: TranslatePayloadItem[] = toTranslate.map((it, i) => ({ i, t: it.title, d: it.description }));
    const translations = await translateBatch(payload);
    if (!translations) return;

    for (const tr of translations) {
        const item = toTranslate[tr?.i];
        if (!item || typeof tr.t !== "string" || !tr.t) continue;
        item.title = tr.t;
        item.description = typeof tr.d === "string" ? tr.d : item.description;
        item.translated = true;
        if (translationMemo.size >= TRANSLATION_MEMO_MAX) {
            const oldest = translationMemo.keys().next().value;
            if (oldest !== undefined) translationMemo.delete(oldest);
        }
        translationMemo.set(item.link, { title: item.title, description: item.description });
    }
};

// --- In-site article reader --------------------------------------------------
// Fetches the source article page, extracts its main paragraphs, and translates
// them to Arabic so readers stay on the site instead of being redirected out.

export interface NewsArticle {
    paragraphs: string[];
    translated: boolean;
    sourceUrl: string;
}

const ARTICLE_MAX_PARAGRAPHS = 8;
const ARTICLE_MAX_PARAGRAPH_CHARS = 600;

// Readability-lite: prefer paragraphs inside <article>, fall back to the whole
// page, and keep only substantial text blocks (skips nav labels, captions, etc.).
const extractParagraphs = (html: string): string[] => {
    const $ = cheerio.load(html);
    $("script, style, nav, header, footer, aside, figure, figcaption").remove();

    const scopes = ["article p", "main p", "p"];
    for (const scope of scopes) {
        const paragraphs: string[] = [];
        $(scope).each((_, el) => {
            if (paragraphs.length >= ARTICLE_MAX_PARAGRAPHS) return false;
            const text = $(el).text().replace(/\s+/g, " ").trim();
            // Short fragments are usually UI chrome, bylines or cookie banners.
            if (text.length >= 60) paragraphs.push(text.slice(0, ARTICLE_MAX_PARAGRAPH_CHARS));
        });
        if (paragraphs.length >= 2) return paragraphs;
    }
    return [];
};

export const fetchArticle = async (item: NewsItem): Promise<NewsArticle> => {
    const fallback: NewsArticle = {
        // With no extractable body, the (possibly already translated) RSS
        // description is still a valid single-paragraph article.
        paragraphs: item.description ? [item.description] : [],
        translated: item.translated,
        sourceUrl: item.link,
    };

    const html = await fetchXml(item.link, 12000);
    if (!html) return fallback;

    let paragraphs = extractParagraphs(html);
    if (paragraphs.length === 0) return fallback;

    // Arabic-native sources need no translation pass.
    const isArabic = /[؀-ۿ]/.test(paragraphs[0]);
    let translated = isArabic;

    if (!isArabic) {
        const payload: TranslatePayloadItem[] = paragraphs.map((p, i) => ({ i, t: p, d: "" }));
        const translations = await translateBatch(payload);
        if (translations) {
            const out = [...paragraphs];
            let translatedCount = 0;
            for (const tr of translations) {
                if (typeof tr?.i === "number" && typeof tr.t === "string" && tr.t && out[tr.i] !== undefined) {
                    out[tr.i] = tr.t;
                    translatedCount++;
                }
            }
            if (translatedCount > 0) {
                paragraphs = out;
                translated = true;
            }
        }
    }

    return { paragraphs, translated, sourceUrl: item.link };
};

export const fetchAllNews = async (): Promise<NewsItem[]> => {
    const results = await Promise.allSettled(
        FEEDS.map(async feed => {
            const xml = await fetchXml(feed.url);
            return xml ? parseFeed(xml, feed) : [];
        })
    );

    const items = results.flatMap(r => (r.status === "fulfilled" ? r.value : []));
    await translateToArabic(items);

    return items
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, MAX_TOTAL_ITEMS)
        .map(({ lang: _lang, ...item }) => item);
};
