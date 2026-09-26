import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      // As rotas de IA (/api/chat, /api/extract-names) só existem de verdade
      // quando publicadas na Vercel (funções serverless). Rodando localmente
      // com "npm run dev", o Vite não sabe servi-las — esse proxy encaminha
      // essas chamadas pra produção, reescrevendo o Origin/Referer pra passar
      // na checagem de segurança que essas rotas já fazem (só aceitam
      // chamadas vindas de notas-professor.vercel.app).
      '/api': {
        target: 'https://notas-professor.vercel.app',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('origin', 'https://notas-professor.vercel.app')
            proxyReq.setHeader('referer', 'https://notas-professor.vercel.app/')
          })
        },
      },
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Diário do Professor',
        short_name: 'Diário Prof',
        description: 'Aplicativo de registro de avaliações por turma',
        theme_color: '#3D1A0A',
        background_color: '#F2DEB3',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
