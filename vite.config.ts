import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // Stamped into the bundle so a deployed build can be identified from the
  // browser. Vercel exposes the commit at build time; anywhere else this is
  // just "dev". Without it there is no way to tell a stale cached bundle from
  // a fix that was never deployed — they look identical from the outside.
  const buildId = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'dev';

  return {
    define: {
      __BUILD_ID__: JSON.stringify(buildId),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      hmr: false,
      watch: null,
    },
    build: {
      chunkSizeWarningLimit: 5000,
    },
  };
});
