import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// «vite build --mode desktop» genera la interfaz de la versión de escritorio (Electron) en dist-desktop/,
// sin service worker: los archivos se sirven desde el propio programa.
export default defineConfig(({ mode }) => mode === 'desktop' ? {
  base: '/',
  build: { outDir: 'dist-desktop', emptyOutDir: true, target: 'chrome120' },
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
  plugins: [preact()],
} : {
  base: '/codice-vivo-web/',
  build: { outDir: 'docs', emptyOutDir: true, target: 'es2020' },
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,png,svg,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallback: '/codice-vivo-web/index.html',
      },
      manifest: {
        name: 'Códice vivo',
        short_name: 'Códice vivo',
        description: 'Biblia de estudio 100% local',
        lang: 'es',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/codice-vivo-web/',
        scope: '/codice-vivo-web/',
        id: '/codice-vivo-web/',
        background_color: '#FFFBF5',
        theme_color: '#7A4A1E',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
