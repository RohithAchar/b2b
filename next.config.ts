import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    // The Supabase storage CDN serves already-optimised JPEGs, and this
    // network resolves *.supabase.co to NAT64 IPv6 (64:ff9b::/96), which
    // Next's image optimizer classifies as a private IP and refuses to fetch.
    // Serving the URLs directly keeps every storefront image working.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
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
      "recharts",
      "@base-ui/react",
      "cmdk",
      "embla-carousel-react",
      "react-day-picker",
      "date-fns",
      "@tiptap/react",
      "@tiptap/starter-kit",
      "@tiptap/extension-link",
    ],
  },
}

export default nextConfig
