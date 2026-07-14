// Shared between the Express news aggregator (server/newsFeed.ts) and the Netlify
// Function (netlify/functions/translate-news.mts) so both providers use the exact
// same instruction and JSON contract: [{ i, t, d }] in → [{ i, t, d }] out.
export interface TranslatePayloadItem {
    i: number; // caller-side index used to match translations back to items
    t: string; // title
    d: string; // description
}

export const TRANSLATE_MODEL = "gemini-2.5-flash";

export const buildTranslatePrompt = (payload: TranslatePayloadItem[]): string =>
    "ترجم عناوين وأوصاف الأخبار الرياضية التالية من الإنجليزية إلى العربية بأسلوب صحفي رياضي عربي طبيعي. " +
    "أعد مصفوفة JSON فقط بنفس البنية والترتيب: [{\"i\":0,\"t\":\"العنوان المترجم\",\"d\":\"الوصف المترجم\"}].\n\n" +
    JSON.stringify(payload);
