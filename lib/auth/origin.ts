const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

type HeaderReader = { get(name: string): string | null };

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Deterministically resolve the origin the app is being served from, without
 * trusting any single header. Supabase re-validates the callback URL we send
 * as `redirectTo`/`emailRedirectTo` against the project's Redirect allow-list;
 * an invalid value silently falls back to the project's Site URL (which in
 * production would drop a local user onto the deployed domain).
 *
 * Priority:
 *   1. `x-forwarded-proto` × `x-forwarded-host` — set by Vercel/edge proxies.
 *   2. `Origin` header — the browser's own request origin (same-origin for
 *      Server Actions), so it matches whatever host the user is actually on.
 *   3. `Host` header + scheme inference — localhost gets http, everything
 *      else https.
 *
 * Returns `null` when nothing yields a valid http(s) origin so callers can
 * fail closed instead of emitting an invalid redirect target.
 */
export function resolveAppUrl(headers: HeaderReader): string | null {
  const forwardProto = headers.get("x-forwarded-proto");
  const forwardHost = headers.get("x-forwarded-host");
  if (forwardProto && forwardHost) {
    const forwarded = `${forwardProto}://${forwardHost}`;
    if (isHttpUrl(forwarded)) {
      return forwarded;
    }
  }

  const origin = headers.get("origin");
  if (origin && isHttpUrl(origin)) {
    return origin.replace(/\/+$/, "");
  }

  const host = headers.get("host");
  if (host) {
    const hostname = host.split(":")[0].toLowerCase();
    const scheme = LOCAL_HOSTNAMES.has(hostname) ? "http" : "https";
    const candidate = `${scheme}://${host}`;
    if (isHttpUrl(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function buildAuthCallbackUrl(
  headers: HeaderReader,
  next: string,
): string | null {
  const appUrl = resolveAppUrl(headers);
  if (!appUrl) return null;
  return `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`;
}