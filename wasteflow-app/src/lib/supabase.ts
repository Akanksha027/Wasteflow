// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://elbbxqrkriezcyhqvfww.supabase.co';

// Use the JWT anon key on React Native. The sb_publishable_ key + a custom
// fetch wrapper drops Authorization headers in Expo and Auth returns
// "Database error querying schema".
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[WasteFlow] Missing EXPO_PUBLIC_SUPABASE_URL or key in .env');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
