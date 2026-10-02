import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS, so it is only for server-side work that
 * the Data API deliberately refuses to expose -- currently writing product
 * image embeddings (lib/ai/index-product-image.ts) from the backfill script.
 *
 * Never import this from a client component or a "use client" module: the key
 * would be bundled into the browser. Never pass it to anything that runs in
 * the browser.
 *
 * A new client per call, matching lib/supabase/server.ts: with Fluid compute
 * a cached client can outlive the request that created it.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase service-role credentials are not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}