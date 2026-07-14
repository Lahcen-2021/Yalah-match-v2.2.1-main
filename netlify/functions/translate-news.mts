// Translates football news items to Arabic through the Netlify AI Gateway.
// Runs as a Netlify Function because the gateway's credentials (GEMINI_API_KEY +
// GOOGLE_GEMINI_BASE_URL) are auto-injected only inside Netlify's runtime — the
// external Express backend calls this endpoint instead of holding a raw key.
//
// Requirements: AI enabled on the Netlify site + at least one production deploy.
// Optional: set TRANSLATE_SECRET (same value on both Netlify and the backend) so
// the endpoint can't be farmed as a free translator by third parties.
import { GoogleGenAI } from "@google/genai";
import { buildTranslatePrompt, TRANSLATE_MODEL, type TranslatePayloadItem } from "../../server/translatePrompt";

const MAX_ITEMS = 40;
const MAX_TEXT = 600; // matches ARTICLE_MAX_PARAGRAPH_CHARS in server/newsFeed.ts

export default async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    const secret = process.env.TRANSLATE_SECRET;
    if (secret && req.headers.get("x-translate-secret") !== secret) {
        return new Response("Unauthorized", { status: 401 });
    }

    let items: unknown;
    try {
        items = (await req.json())?.items;
    } catch {
        items = undefined;
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
        return Response.json(
            { error: `Body must be { items: [{ i, t, d }] } with 1-${MAX_ITEMS} items` },
            { status: 400 },
        );
    }

    // Strictly re-shape the payload: numbers and length-capped strings only, so the
    // endpoint can't be repurposed to smuggle arbitrary prompts to the model.
    const payload: TranslatePayloadItem[] = items
        .filter((it: any) => typeof it?.i === "number" && typeof it?.t === "string" && it.t)
        .map((it: any) => ({
            i: it.i,
            t: String(it.t).slice(0, MAX_TEXT),
            d: typeof it.d === "string" ? it.d.slice(0, MAX_TEXT) : "",
        }));
    if (payload.length === 0) return Response.json([]);

    try {
        const ai = new GoogleGenAI({}); // gateway base URL + placeholder key are auto-injected
        const response = await ai.models.generateContent({
            model: TRANSLATE_MODEL,
            contents: buildTranslatePrompt(payload),
            config: { responseMimeType: "application/json", temperature: 0.2 },
        });
        const translations = JSON.parse(response.text || "[]");
        return Response.json(Array.isArray(translations) ? translations : []);
    } catch (e) {
        console.error("[translate-news] AI Gateway call failed:", (e as Error).message);
        return Response.json({ error: "Translation failed" }, { status: 502 });
    }
};

export const config = {
    path: "/translate-news",
    method: ["POST"],
};
