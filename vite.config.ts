/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_VERSION = '1.0.0';
const BUILD_TIMESTAMP = new Date().toISOString();

// Plugin to generate version.json at build time
const versionPlugin = () => ({
  name: 'version-plugin',
  buildStart() {
    const versionInfo = {
      version: APP_VERSION,
      buildTime: BUILD_TIMESTAMP
    };
    
    // Ensure public directory exists
    if (!fs.existsSync('public')) {
      fs.mkdirSync('public', { recursive: true });
    }
    
    fs.writeFileSync('public/version.json', JSON.stringify(versionInfo, null, 2));
    console.log(`Generated version.json: v${APP_VERSION} @ ${BUILD_TIMESTAMP}`);
  }
});

// Workaround for environments where the @/ alias is not applied during import analysis.
// Rewrites @/foo -> /src/foo at transform-time so Vite can resolve modules reliably.
const rewriteAtAliasPlugin = () => ({
  name: "rewrite-at-alias",
  enforce: "pre" as const,
  transform(code: string, id: string) {
    // Only rewrite our app source files.
    if (!id.includes("/src/")) return;

    const hasAliasImport =
      code.includes('"@/') ||
      code.includes("'@/") ||
      code.includes('"@lib/') ||
      code.includes("'@lib/") ||
      code.includes('"@components/') ||
      code.includes("'@components/") ||
      code.includes('"@hooks/') ||
      code.includes("'@hooks/") ||
      code.includes('"@contexts/') ||
      code.includes("'@contexts/");

    if (!hasAliasImport) return;

    const rewritten = code
      // static imports/exports
      .replaceAll('from "@/', 'from "/src/')
      .replaceAll("from '@/", "from '/src/")
      .replaceAll('export * from "@/', 'export * from "/src/')
      .replaceAll("export * from '@/", "export * from '/src/")
      // static imports/exports - other aliases
      .replaceAll('from "@components/', 'from "/src/components/')
      .replaceAll("from '@components/", "from '/src/components/")
      .replaceAll('from "@lib/', 'from "/src/lib/')
      .replaceAll("from '@lib/", "from '/src/lib/")
      .replaceAll('from "@hooks/', 'from "/src/hooks/')
      .replaceAll("from '@hooks/", "from '/src/hooks/")
      .replaceAll('from "@contexts/', 'from "/src/contexts/')
      .replaceAll("from '@contexts/", "from '/src/contexts/")
      // dynamic imports
      .replaceAll('import("@/', 'import("/src/')
      .replaceAll("import('@/", "import('/src/")
      .replaceAll('import("@components/', 'import("/src/components/')
      .replaceAll("import('@components/", "import('/src/components/")
      .replaceAll('import("@lib/', 'import("/src/lib/')
      .replaceAll("import('@lib/", "import('/src/lib/");

    if (rewritten === code) return;

    return { code: rewritten, map: null };
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(BUILD_TIMESTAMP),
  },
  plugins: [
    // rewriteAtAliasPlugin(), // Disabled - using relative imports instead
    react(),
    mode === "development" && componentTagger(),
    versionPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'logo.png', 'offline.html'],
      manifest: {
        name: 'FUIK.IO',
        short_name: 'FUIK.IO',
        description: 'Fresh Produce Logistics',
        theme_color: '#00b4d8',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/fnb/driver-mobile',
        icons: [
          {
            src: '/icons/icon-48.png',
            sizes: '48x48',
            type: 'image/png'
          },
          {
            src: '/icons/icon-72.png',
            sizes: '72x72',
            type: 'image/png'
          },
          {
            src: '/icons/icon-76.png',
            sizes: '76x76',
            type: 'image/png'
          },
          {
            src: '/icons/icon-120.png',
            sizes: '120x120',
            type: 'image/png'
          },
          {
            src: '/icons/icon-152.png',
            sizes: '152x152',
            type: 'image/png'
          },
          {
            src: '/icons/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png'
          },
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/supabase/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapbox-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: [
      // Primary alias
      { find: /^@\//, replacement: path.resolve(__dirname, "src") + "/" },

      // Additional aliases seen in some generated/rewritten files
      { find: /^@components\//, replacement: path.resolve(__dirname, "src/components") + "/" },
      { find: /^@lib\//, replacement: path.resolve(__dirname, "src/lib") + "/" },
      { find: /^@hooks\//, replacement: path.resolve(__dirname, "src/hooks") + "/" },
      { find: /^@contexts\//, replacement: path.resolve(__dirname, "src/contexts") + "/" },
      { find: /^@integrations\//, replacement: path.resolve(__dirname, "src/integrations") + "/" },
      { find: /^@pages\//, replacement: path.resolve(__dirname, "src/pages") + "/" },
      { find: /^@utils\//, replacement: path.resolve(__dirname, "src/utils") + "/" },
      { find: /^@types\//, replacement: path.resolve(__dirname, "src/types") + "/" },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
}));
