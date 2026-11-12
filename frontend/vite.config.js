import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ethers-vendor': ['ethers'],
          'lucide-vendor': ['lucide-react'],
          'confetti-vendor': ['canvas-confetti'],
          'viem-vendor': ['viem'],
        },
      },
    },
  },
});
