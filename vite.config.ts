import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => {
    return {
      // Relative base: lazy-loaded chunks/CSS resolve against their own module URL
      // (import.meta.url) instead of the domain root. Required for the WordPress theme,
      // where the bundle is served from /wp-content/themes/yalla-match/app/ and rendered
      // on arbitrary deep routes (e.g. /Team-vs-Team/2026-08-17). With the default base
      // ('/'), Vite's preload helper prepends "/" and requests /assets/*.js|css from the
      // site root — which 404s. Do NOT remove; it replaces the easy-to-forget
      // `vite build --base=./` flag.
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: false,
        watch: {
          ignored: ['**/data/**'],
        },
      },
      // `vite preview` serves the minified production build — the only honest way to measure real
      // performance locally (dev mode ships unminified modules + the React dev build, which inflate
      // TBT/bundle audits). It has no backend, so proxy /api to the running dev server (the Express
      // API). Usage: keep `npm run dev` running, then `npm run build && npm run preview`, and run
      // Lighthouse against the preview URL.
      preview: {
        port: 4173,
        proxy: {
          // Must match server.ts's PORT (3000). It pointed at 3100, where nothing listens,
          // so every /api call under `vite preview` failed and the documented measurement
          // workflow below measured an app with no data.
          '/api': 'http://localhost:3000',
        },
      },
      plugins: [react(), tailwindcss()],
      build: {
        minify: 'terser',
        terserOptions: {
          compress: {
            // drop_console must stay OFF: enabling it made terser mis-compile the
            // match-detail load path and crash the app in production (worked in dev).
            drop_console: false,
            drop_debugger: true,
          },
        },
        rollupOptions: {
          output: {
            // Function form (not the object form) so React/ReactDOM are reliably pulled out of
            // the main app chunk into a long-lived `vendor` chunk — the object form was leaving
            // them in the entry chunk (vendor was only ~3.6 KB). React rarely changes, so a
            // separate chunk stays cached across app deploys.
            // Note: video.js / hls.js are loaded at runtime as CDN globals (window.videojs /
            // window.Hls), never imported as modules, so they intentionally have no chunk here.
            manualChunks(id) {
              if (!id.includes('node_modules')) return undefined;
              if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor';
              if (id.includes('lucide-react')) return 'ui-icons';
              if (/[\\/]node_modules[\\/]motion[\\/]/.test(id) || id.includes('framer-motion')) return 'animations';
              // Firebase is large and updates independently of the app — its own chunk keeps
              // a Firebase bump from invalidating MatchDetailView (which pulls in Firestore votes).
              if (/[\\/]node_modules[\\/]@?firebase[\\/]/.test(id)) return 'firebase';
              // Plyr only mounts on a match page — separate chunk. (plyr-react, video.js and
              // hls.js were removed from dependencies: nothing imported them, the last two are
              // loaded at runtime as CDN globals by components/Players.tsx.)
              if (id.includes('plyr')) return 'player';
              return undefined;
            },
          },
        },
        chunkSizeWarningLimit: 1000,
        cssMinify: true,
        sourcemap: false,
      },
      // No `define` block. It used to inline GEMINI_API_KEY into the client bundle as
      // process.env.API_KEY / process.env.GEMINI_API_KEY. Nothing in the browser code
      // reads either — the Gemini key belongs to server/newsFeed.ts, which runs under
      // tsx and reads process.env directly — so the substitution was dead config that
      // would have baked a secret into a public asset the moment a build environment
      // set the variable. VAPID_PUBLIC_KEY went with it: also unread by client code.
      // Anything the browser genuinely needs should be a VITE_-prefixed env var, which
      // Vite exposes deliberately and which reads as public at the call site.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
