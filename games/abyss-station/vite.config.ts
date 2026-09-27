import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev the Socket.IO server runs separately on :3001 (see `npm run dev`);
// proxy it so the client always talks to its own origin, same as production.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist/client', emptyOutDir: true },
  server: {
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
});
