// Session cookie names shared by the client setter
// (components/storefront/storefront-session.tsx) and the server reader
// (lib/storefront/events.ts). Dependency-free so both runtimes can import it.
export const STOREFRONT_SESSION_COOKIE = "b2b_sid";
export const STOREFRONT_SOURCE_COOKIE = "b2b_src";

export type TrafficSource = "direct" | "search" | "social" | "referral";

const SEARCH_HOSTS = ["google.", "bing.", "yahoo.", "duckduckgo.", "baidu.", "yandex."];
const SOCIAL_HOSTS = [
  "facebook.",
  "instagram.",
  "twitter.",
  "x.",
  "linkedin.",
  "youtube.",
  "youtu.be",
  "pinterest.",
  "threads.",
  "whatsapp.",
  "telegram.",
  "snapchat.",
];

/** Coarse acquisition bucket from a referrer URL. Empty/unknown → direct. */
export function classifyTrafficSource(referrer: string): TrafficSource {
  if (!referrer) return "direct";
  let host = "";
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "direct";
  }
  if (SEARCH_HOSTS.some((marker) => host.includes(marker))) return "search";
  if (SOCIAL_HOSTS.some((marker) => host.includes(marker))) return "social";
  return "referral";
}

export function isTrafficSource(value: unknown): value is TrafficSource {
  return value === "direct" || value === "search" || value === "social" || value === "referral";
}
