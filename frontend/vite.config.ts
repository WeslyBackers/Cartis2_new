import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    // This project volume is mounted at both D:\VW and C:\Data\VW (NTFS mount point).
    // Vite uses realpathSync.native which resolves D:\VW paths to C:\Data\VW,
    // causing a mismatch with the fs.allow list. strict: false prevents false rejections.
    fs: {
      strict: false,
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
