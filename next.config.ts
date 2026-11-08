import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    // Image optimization enabled: AVIF/WebP conversion + auto-resizing via
    // Next.js Image Optimization API. Remote images from Supabase storage are
    // proxied and resized on demand.
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
      "recharts",
      "@tiptap/react",
      "@tiptap/starter-kit",
      "@tiptap/extension-link",
    ],
  },
}

export default nextConfig
