import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages などサブパスに置くときは BASE_PATH=/リポジトリ名/ を付けてビルドする（.github/workflows/deploy.yml が自動で付ける）
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'うまい話チェック',
        short_name: 'うまい話チェック',
        description: '人から勧められた投資の話を、お金を払う前に41項目で点検するアプリ',
        lang: 'ja',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f3eee3',
        theme_color: '#23211f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,md,woff2}'],
        globIgnores: ['ocr/**', 'data/**'],
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          { urlPattern: /\/data\/.*\.json/i, handler: 'NetworkFirst', options: { cacheName: 'registry-data', networkTimeoutSeconds: 5, expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 } } },
          { urlPattern: /\/ocr\/.*/i, handler: 'CacheFirst', options: { cacheName: 'ocr-assets', expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 } } },
          { urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i, handler: 'StaleWhileRevalidate', options: { cacheName: 'google-fonts-css', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } } },
          { urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i, handler: 'CacheFirst', options: { cacheName: 'google-fonts-files', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } } },
        ],
      },
    }),
  ],
  build: { target: 'es2022' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
