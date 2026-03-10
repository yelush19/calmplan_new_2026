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

// Log which VITE_* env vars are available at build time.
// This helps diagnose Vercel env var injection issues.
function envDebugPlugin() {
  return {
    name: 'env-debug',
    buildStart() {
      console.log('\n=== CalmPlan Build-Time Environment ===');
      console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'SET (' + process.env.VITE_SUPABASE_URL.substring(0, 20) + '...)' : 'EMPTY');
      console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'SET (length=' + process.env.VITE_SUPABASE_ANON_KEY.length + ')' : 'EMPTY');
      console.log('NODE_ENV:', process.env.NODE_ENV || '(not set)');
      console.log('VERCEL:', process.env.VERCEL || '(not set)');
      console.log('========================================\n');
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), electronCrossOriginFix(), envDebugPlugin()],
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
  // Explicitly inject Supabase env vars from process.env into the bundle.
  // Vercel sets process.env.VITE_* but Vite may not pick them up automatically
  // when there is no .env file present (which is gitignored).
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || ''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || ''),
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
}) 