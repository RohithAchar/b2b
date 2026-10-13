// Session cookie names shared by the client setter
// (components/storefront/storefront-session.tsx) and the server reader
// (lib/storefront/events.ts). Dependency-free so both runtimes can import it.
export const STOREFRONT_SESSION_COOKIE = "b2b_sid";
export const STOREFRONT_SOURCE_COOKIE = "b2b_src";
export const STOREFRONT_DEVICE_COOKIE = "b2b_dev";

export type TrafficSource = "direct" | "search" | "social" | "referral";

export type DeviceClass = "desktop" | "mobile" | "tablet";

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

const MOBILE_MARKERS = [
  "mobi", "android", "iphone", "ipod", "windows phone", "blackberry",
  "opera mini", "opera mobi", "mobile",
];
const TABLET_MARKERS = ["ipad", "tablet", "kindle", "silk", "playbook", "nexus 7", "nexus 9"];

/**
 * Coarse device bucket from a user-agent string. Only three buckets are
 * ever stored — the raw UA string never leaves the browser.
 */
export function classifyDevice(userAgent: string): DeviceClass {
  const ua = userAgent.toLowerCase();
  if (TABLET_MARKERS.some((marker) => ua.includes(marker))) return "tablet";
  if (MOBILE_MARKERS.some((marker) => ua.includes(marker))) return "mobile";
  return "desktop";
}

export function isDeviceClass(value: unknown): value is DeviceClass {
  return value === "desktop" || value === "mobile" || value === "tablet";
}
