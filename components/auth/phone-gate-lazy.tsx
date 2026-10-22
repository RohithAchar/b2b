"use client"

import dynamic from "next/dynamic"

/**
 * Deferred mount for the global phone gate. The gate needs Supabase auth on
 * the client but renders nothing for most visitors, so loading it after
 * hydration keeps the ~257 KB supabase-js chunk off the first load.
 */
export const PhoneGate = dynamic(
  () => import("./phone-gate").then((mod) => mod.PhoneGate),
  { ssr: false }
)
