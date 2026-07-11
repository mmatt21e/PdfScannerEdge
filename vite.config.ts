/// <reference types="vitest/config" />
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// PocketScan Vite configuration.
// - React + strict TypeScript.
// - vite-plugin-pwa (Workbox under the hood) for the service worker + manifest.
// - Vitest for unit tests (jsdom environment).
export default defineConfig(({ mode }) => ({
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // `npm run dev:https` runs with mode "https" (see the basic-ssl plugin below) so phones
    // on the LAN can access the camera, which requires a secure context.
    host: true,
    port: 5173,
  },
  worker: {
    format: 'es',
  },
  plugins: [
    react(),
    // Self-signed certificate for local HTTPS testing on real devices.
    ...(mode === 'https' ? [basicSsl() as PluginOption] : []),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null, // We register/manage the SW ourselves in src/services/pwa.
      strategies: 'generateSW',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        name: 'PocketScan — Document Scanner',
        short_name: 'PocketScan',
        description:
          'Scan paper documents with your phone camera and save them as PDFs. Works offline. Your scans stay on your device.',
        theme_color: '#1f6feb',
        background_color: '#0d1117',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
    },
  },
}));
