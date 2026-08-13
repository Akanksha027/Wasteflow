// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://elbbxqrkriezcyhqvfww.supabase.co';
const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'sb_publishable_0CZcc3nLwXeofBmHbb89jw_3XjMfo44';

// The new Supabase publishable-key format (sb_publishable_...) is an opaque
// string, not a JWT. The JS client sets "Authorization: Bearer <key>" by default,
// but Supabase expects "apikey: <key>" for these new keys. We fix that here.
function isNewKey(key: string): boolean {
  return key.startsWith('sb_publishable_') || key.startsWith('sb_secret_');
}

function createSupabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request
        ? (input as Request).headers
        : undefined
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, k) => headers.set(k, value));
    }
    if (isNewKey(key) && headers.get('Authorization') === `Bearer ${key}`) {
      headers.delete('Authorization');
    }
    headers.set('apikey', key);
    return fetch(input as RequestInfo, { ...init, headers });
  };
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    fetch: createSupabaseFetch(SUPABASE_KEY),
  },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
