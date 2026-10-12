import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy API requests to the real gateway so local dev works seamlessly without running local gateway
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/gw': {
        target: 'https://workflow-automation-1ujz.onrender.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gw/, ''),
        secure: false,
      },
    },
  },
})
