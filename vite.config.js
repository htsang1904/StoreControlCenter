import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'lord-icon',
        },
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: process.env.FRONTEND_PORT ? parseInt(process.env.FRONTEND_PORT) : 5173,
    strictPort: true, // Fail if port is already in use instead of falling back
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          if (id.includes('/vue/') || id.includes('/vue-router/')) {
            return 'vue-vendor'
          }

          if (id.includes('/apexcharts/') || id.includes('/vue3-apexcharts/')) {
            return 'charts-vendor'
          }

          if (
            id.includes('/preline/') ||
            id.includes('/@preline/') ||
            id.includes('/dropzone/') ||
            id.includes('/vanilla-calendar-pro/') ||
            id.includes('/@lordicon/')
          ) {
            return 'ui-vendor'
          }

          if (id.includes('/lodash/') || id.includes('/jquery/')) {
            return 'utility-vendor'
          }

          return 'vendor'
        },
      },
    },
  }
})
