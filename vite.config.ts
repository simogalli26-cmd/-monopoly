import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** Game portals: load the CrazyGames SDK from index.html, where their checker expects it. */
const crazyGamesSdk = (): Plugin => ({
  name: 'crazygames-sdk',
  transformIndexHtml: (html) =>
    html
      .replace('<head>', '<head>\n    <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>')
      // Icons and the web app manifest are only for the website.
      .replace(/\s*<link rel="(icon|apple-touch-icon|manifest)"[^>]*>/g, ''),
});

export default defineConfig(({ mode }) => {
  const portal = mode === 'portal';
  return {
    // Portal build = a single self-contained index.html: no folders that an upload could flatten.
    plugins: portal ? [react(), crazyGamesSdk(), viteSingleFile()] : [react()],
    build: portal ? { outDir: 'dist/portal', emptyOutDir: true, copyPublicDir: false } : { outDir: 'dist/client', emptyOutDir: true },
    server: {
      port: 5173,
      proxy: {
        '/socket.io': { target: 'http://localhost:3001', ws: true },
      },
    },
    test: { include: ['tests/**/*.test.ts'] },
  } as any;
});
