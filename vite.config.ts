import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
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
          '/api': 'http://localhost:3100',
        },
      },
      plugins: [react(), tailwindcss()],
      build: {
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: true,
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
              return undefined;
            },
          },
        },
        chunkSizeWarningLimit: 1000,
        cssMinify: true,
        sourcemap: false,
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.VAPID_PUBLIC_KEY': JSON.stringify(env.VAPID_PUBLIC_KEY || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
