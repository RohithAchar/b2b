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
  },
}

export default nextConfig
