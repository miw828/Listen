import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const envFiles = ['.env', 'db.env'];

for (const envFile of envFiles) {
  const envPath = resolve(process.cwd(), envFile);

  if (!existsSync(envPath)) continue;

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').trim();

    if (!process.env[key]) {
      process.env[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const usesServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export function getSupabase(req) {
  const authHeader = usesServiceRole ? undefined : req.get?.('authorization');
  const headers = authHeader ? { Authorization: authHeader } : undefined;

  return createClient(supabaseUrl, supabaseKey, {
    global: { headers },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// One note: normal PowerShell npm was blocked by execution policy, so use npm.cmd run build / npm.cmd run lint on this Windows setup.

// Next useful steps:

// Run npm.cmd run dev from spotify-app to test the app in-browser.
// Confirm your Supabase env vars are in Vite format: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.
// Confirm your comment/like tables exist, since the UI now compiles but those actions depend on your database schema.

// 8:19 PM