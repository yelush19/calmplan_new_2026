import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Strip crossorigin attribute from Vite-generated asset tags.
// Electron loads HTML via file:// protocol where crossorigin
// causes silent CORS failures → white screen.
function electronCrossOriginFix() {
  return {
    name: 'electron-crossorigin-fix',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin/g, '<script type="module"')
        .replace(/<link rel="stylesheet" crossorigin/g, '<link rel="stylesheet"');
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), electronCrossOriginFix()],
  // Use relative paths so Electron can load from file:// protocol
  base: './',
  server: {
    allowedHosts: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
}) 