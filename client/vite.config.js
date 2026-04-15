import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001',
      '/storage': 'http://localhost:3001',
      '/preview': 'http://localhost:3001',
      '/templates': 'http://localhost:3001',
    },
  },
  build: {
    outDir: 'dist',
  },
});
