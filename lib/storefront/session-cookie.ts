// Session cookie name shared by the client setter
// (components/storefront/storefront-session.tsx) and the server reader
// (lib/storefront/events.ts). Dependency-free so both runtimes can import it.
export const STOREFRONT_SESSION_COOKIE = "b2b_sid";
