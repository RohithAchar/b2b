import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    // Retested 2026-10-06: keep direct serving until `/_next/image?url=<supabase>`
    // returns 200 in both `pnpm dev` and `pnpm start`. This network resolves
    // *.supabase.co to NAT64 IPv6 (64:ff9b::/96), which the optimizer rejects
    // as a private IP. Mitigation is Supabase `/render/image` transforms via
    // `publicTransformedImageUrl()` in heavy slots. To retest, comment out
    // `unoptimized`, `rm -rf .next`, and curl `/_next/image?url=<encoded>`.
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/render/image/public/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // KYB uploads: 3 documents × 10 MB max. Per-file type/size rules are
      // enforced in lib/supplier/kyb.ts after parsing.
      bodySizeLimit: "32mb",
    },
    // Dev-memory fix (8 GB RAM machines were swapping): several dependencies
    // ship a single barrel that re-exports thousands of modules — notably
    // `@hugeicons/core-free-icons` (~148 MB, imported by ~60 files) and
    // `recharts` (`import *`). Without this, compiling any page that touches
    // one icon parses the entire barrel. This rewrites those imports to
    // per-module paths at compile time; no source changes needed.
    optimizePackageImports: [
      "@hugeicons/core-free-icons",
      "@hugeicons/react",
      "@base-ui/react",
      "embla-carousel-react",
      "@tiptap/react",
      "@tiptap/starter-kit",
      "@tiptap/extension-link",
    ],
  },
}

export default nextConfig
