/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages（https://<ユーザー>.github.io/watakush1goto-web/）に置くので、パスの頭をリポジトリ名にする
export default defineConfig({
  base: '/watakush1goto-web/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'わたくしごと',
        short_name: 'わたくしごと',
        description: '調子と睡眠を記録して、診察やカウンセリングで先生に見せる1画面にまとめます。',
        lang: 'ja',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        background_color: '#EEF1F4',
        theme_color: '#EEF1F4',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 日本語フォントは字の範囲ごとに分かれていて数が多いので、最初に全部は入れず、使った分だけ取っておく
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 400 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
