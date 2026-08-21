/// <reference types="vite/client" />

// Pulls in Vite's ambient types:
//   - `import.meta.env` (typed as ImportMetaEnv), used by services/config.ts
//     for VITE_API_BASE and by MatchDetailView for the dev-only branches.
//   - Asset module declarations (*.svg, *.png, *.jpg, *.jpeg, *.webp, *.avif,
//     *.gif, ...) resolved to their emitted URL.
//
// Do NOT re-declare those asset modules here: duplicating an ambient module
// that vite/client already declares is a compile error, and the hand-rolled
// list is what caused `*.jpg` imports to fail typechecking.

interface ImportMetaEnv {
    /** Base URL of the Cloudflare Pages API. See services/config.ts. */
    readonly VITE_API_BASE?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
