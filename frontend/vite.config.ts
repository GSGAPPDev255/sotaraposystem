import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Inject the SW registration script automatically
      injectRegister: 'auto',
      // Assets to include in the SW precache
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Sotara',
        short_name: 'Sotara',
        description: 'Invoice & expense approval system',
        theme_color: '#070918',
        background_color: '#070918',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
        shortcuts: [
          {
            name: 'Submit Expense',
            short_name: 'Expense',
            description: 'Submit a new expense claim',
            url: '/my-expenses',
            icons: [{ src: 'icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // Pre-cache all built assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Cache navigation requests with the app shell
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/functions\//, /^\/auth\//],
        runtimeCaching: [
          // Supabase API — always fresh (network-only)
          {
            urlPattern: ({ url }) =>
              url.hostname.includes('.supabase.co'),
            handler: 'NetworkOnly',
          },
          // Google Fonts stylesheets — cache first, 1 year
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // Google Fonts files — cache first, 1 year
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      // Dev options — enable SW in development for testing
      devOptions: {
        enabled: false, // set true to test SW locally
        type: 'module',
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
});
