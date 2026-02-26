  import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Backend API – use 127.0.0.1 to avoid IPv6 (::1) issues on Windows
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      // Socket.IO real-time notifications (same backend)
      '/socket.io': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            // Expected when backend is stopped/restarting; socket client will reconnect
            if (err.code !== 'ECONNABORTED' && err.code !== 'ECONNRESET') console.error('[socket.io proxy]', err.message);
          });
        },
      },
    },
  },
})
