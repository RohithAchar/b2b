// Single source of truth for the public site URL and display name.
// Set NEXT_PUBLIC_APP_URL in production; localhost is a dev-only default.

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const SITE_NAME = "B2B Marketplace";