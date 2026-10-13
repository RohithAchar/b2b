"use client";

import { useEffect } from "react";
import {
  STOREFRONT_SESSION_COOKIE,
  STOREFRONT_SOURCE_COOKIE,
  classifyTrafficSource,
} from "@/lib/storefront/session-cookie";

function readCookie(name: string): string | null {
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/**
 * Ensures every storefront visitor (signed in or anonymous) carries a stable
 * `b2b_sid` cookie for the tab lifetime. Server actions read it to attribute
 * append-only analytics events to sessions. Renders nothing.
 */
export function StorefrontSession() {
  useEffect(() => {
    if (!readCookie(STOREFRONT_SESSION_COOKIE)) {
      const sessionId =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      // Session cookie (no max-age): lasts until the tab closes.
      document.cookie = `${STOREFRONT_SESSION_COOKIE}=${encodeURIComponent(sessionId)}; path=/; SameSite=Lax`;
      // Acquisition source, captured once per session from the referrer.
      const source = classifyTrafficSource(document.referrer);
      document.cookie = `${STOREFRONT_SOURCE_COOKIE}=${source}; path=/; SameSite=Lax`;
    }
  }, []);

  return null;
}
