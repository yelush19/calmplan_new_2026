#!/usr/bin/env node
/**
 * Pre-build check: Ensures Supabase credentials are configured
 * so the Electron app uses cloud sync (not local-only mode).
 *
 * Run before electron:build to verify .env is properly set up.
 */

const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env');
const envExamplePath = path.resolve(__dirname, '..', '.env.example');

console.log('\n=== CalmPlan Build Environment Check ===\n');

if (!fs.existsSync(envPath)) {
  console.warn('WARNING: No .env file found!');
  console.warn('The app will run in LOCAL-ONLY mode (no cloud sync).');
  console.warn(`\nCreate a .env file based on ${envExamplePath}:`);
  console.warn('  cp .env.example .env');
  console.warn('  # Then edit .env with your Supabase credentials\n');

  // Don't block the build, just warn
  if (process.argv.includes('--strict')) {
    console.error('ERROR: --strict mode requires .env file. Aborting build.');
    process.exit(1);
  }
  process.exit(0);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const lines = envContent.split('\n');

let supabaseUrl = '';
let supabaseKey = '';

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;

  const [key, ...valueParts] = trimmed.split('=');
  const value = valueParts.join('=').trim();

  if (key.trim() === 'VITE_SUPABASE_URL') supabaseUrl = value;
  if (key.trim() === 'VITE_SUPABASE_ANON_KEY') supabaseKey = value;
}

const isUrlValid = supabaseUrl && !supabaseUrl.includes('YOUR_PROJECT_ID') && supabaseUrl.startsWith('https://');
const isKeyValid = supabaseKey && !supabaseKey.includes('your_anon_key') && supabaseKey.length > 20;

if (isUrlValid && isKeyValid) {
  console.log('VITE_SUPABASE_URL:      OK');
  console.log('VITE_SUPABASE_ANON_KEY: OK');
  console.log('\nCloud sync will be ENABLED in this build.');
  console.log('Data will sync between all devices using the same Supabase project.\n');
} else {
  if (!isUrlValid) {
    console.warn('VITE_SUPABASE_URL:      MISSING or invalid');
  } else {
    console.log('VITE_SUPABASE_URL:      OK');
  }
  if (!isKeyValid) {
    console.warn('VITE_SUPABASE_ANON_KEY: MISSING or invalid');
  } else {
    console.log('VITE_SUPABASE_ANON_KEY: OK');
  }

  console.warn('\nWARNING: Cloud sync will be DISABLED.');
  console.warn('The app will save data locally only (not synced between devices).');
  console.warn('Update your .env file with valid Supabase credentials to enable sync.\n');

  if (process.argv.includes('--strict')) {
    console.error('ERROR: --strict mode requires valid Supabase credentials. Aborting build.');
    process.exit(1);
  }
}
