/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

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
    react(), 
    mode === "development" && componentTagger(),
    versionPlugin()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
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
