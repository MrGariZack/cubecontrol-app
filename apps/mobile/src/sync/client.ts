import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SUPABASE_ANON_KEY, DEFAULT_SUPABASE_URL } from "@tonehub/library-sync/supabase";
import { durableMobileAuthStorage, MOBILE_AUTH_STORAGE_KEY } from "./authStorage";

export function createMobileClient(): SupabaseClient {
  return createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
    auth: {
      storage: durableMobileAuthStorage,
      storageKey: MOBILE_AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}
