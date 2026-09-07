import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

export function supabaseServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function hasRemoteDb() {
  return Boolean(supabaseUrl() && supabaseServiceKey());
}

export function createAdminClient(): SupabaseClient | null {
  if (!hasRemoteDb()) return null;
  return createClient(supabaseUrl(), supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
