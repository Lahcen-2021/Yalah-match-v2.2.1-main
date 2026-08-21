// Single source of truth for the backend base URL.
//
// The public API is a separate project (Cloudflare Pages Functions + D1) at
// https://yallamatchapi-jdwel.pages.dev. Its CORS allows yallamatch.online,
// www.yallamatch.online and the usual localhost dev ports, so the browser may
// call it directly. Override per-environment with VITE_API_BASE.
//
// The OLD host `yallamatch.pages.dev` is a dead Pages project in a different
// Cloudflare account — do not use it.
export const API_BASE: string =
    (import.meta.env?.VITE_API_BASE as string | undefined) ?? 'https://yallamatchapi-jdwel.pages.dev';
