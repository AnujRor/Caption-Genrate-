import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Read defensively so the app can also be prerendered in Node during the build.
const env = (import.meta as any).env ?? {};
const url = env.VITE_SUPABASE_URL as string | undefined;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Null when Supabase isn't configured; the app then works fully offline as before. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

/** Signed-in user's id from the locally stored session (no network round trip). */
export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
