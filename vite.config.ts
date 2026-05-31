import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type UserConfig } from 'vite';

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      sourcemap: false,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          passes: 3,
        },
        mangle: {
          toplevel: true,
        },
        format: {
          comments: false,
        },
      },
      rollupOptions: {
        output: {
          // Randomize chunk names to complicate reverse engineering
          chunkFileNames: 'assets/[hash].js',
          entryFileNames: 'assets/[hash].js',
          assetFileNames: 'assets/[hash].[ext]',
          manualChunks(id) {
            // Map stack (Leaflet is ~200KB raw — keep isolated for parallel load + caching)
            if (id.includes('leaflet') || id.includes('react-leaflet')) return 'vendor-map';
            // Animation (motion/framer)
            if (id.includes('framer-motion') || id.includes('/motion/')) return 'vendor-motion';
            // Icons (lucide ships many modules — worth a separate chunk for cache hit)
            if (id.includes('lucide-react')) return 'vendor-icons';
            // React core + router
            if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
            if (id.includes('node_modules/react/')) return 'vendor-react';
          },
        },
      },
    },
    server: {
      hmr: true,
    },
  } satisfies UserConfig;
});
