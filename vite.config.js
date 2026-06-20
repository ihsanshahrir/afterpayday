import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/afterpayday/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-32x32.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'AfterPayday',
        short_name: 'AfterPayday',
        description: 'Track your monthly expenses, debt, and income.',
        theme_color: '#10b981',
        background_color: '#06040e',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/afterpayday/',
        start_url: '/afterpayday/',
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
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        // Keep the ~13 MB Tesseract OCR engine out of the precache so the base
        // app install stays small; it is runtime-cached on first scan instead.
        globIgnores: ['**/tesseract/**'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Serve the app shell network-first so a fresh deploy loads on the
            // next online launch instead of being pinned to the precached HTML.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-shell',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 10 },
            },
          },
          {
            // OCR engine + language data: fetched lazily on the first scan, then
            // cached so receipt scanning works fully offline afterwards.
            urlPattern: ({ url }) => url.pathname.includes('/tesseract/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract-ocr',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
