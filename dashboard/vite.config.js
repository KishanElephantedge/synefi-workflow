import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy API requests to the real gateway so local dev works seamlessly without running local gateway
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/gw': {
        // workflow-automation-1ujz suspended again (Render free-tier bandwidth cap, 2026-10-20)
        // -- rotated to -48nk, confirmed live and on the correct current DB (not a stale copy:
        // it has real partner_tasks rows Majji created on 2026-10-16 and Sandy Yu's
        // post-reconciliation 9-account count, not the raw 49).
        target: 'https://workflow-automation-48nk.onrender.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gw/, ''),
        secure: false,
      },
    },
  },
})
