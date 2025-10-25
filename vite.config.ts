import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Solo fallback offline per produzione, non per sviluppo
        navigateFallback: 'offline.html',
        navigateFallbackDenylist: [/^\/api/],
        // Strategia di cache per l'app
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 anno
              }
            }
          }
        ]
      },
      manifest: {
        "short_name": "Turni P.L.",
        "name": "Gestione Turni P.L.",
        "description": "Un'app per agenti di Polizia Locale per gestire ferie, permessi, straordinari e reperibilità.",
        "icons": [
          {
            "src": "icon-128.png",
            "type": "image/png",
            "sizes": "128x128"
          },
          {
            "src": "icon-192.png",
            "type": "image/png",
            "sizes": "192x192"
          },
          {
            "src": "icon-256.png",
            "type": "image/png",
            "sizes": "256x256"
          },
          {
            "src": "icon-512.png",
            "type": "image/png",
            "sizes": "512x512"
          }
        ],
        "start_url": "/",
        "display": "standalone",
        "theme_color": "#005A9C",
        "background_color": "#f4f7fc",
        "orientation": "portrait"
      },
      devOptions: {
        enabled: false // Disabilitato in sviluppo
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/utils/**/*.ts'],
      exclude: [
        'api/**',
        'dist/**',
        'dev-dist/**',
        'node_modules/**',
        'public/**',
        'src/**/*.tsx',
        'src/services/**',
        'src/hooks/**',
        'src/lib/**',
        'src/server.backup/**',
        '**/*.d.ts'
      ]
    }
  }
})