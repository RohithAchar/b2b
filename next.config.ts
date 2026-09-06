import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // KYB uploads: 3 documents × 10 MB max. Per-file type/size rules are
      // enforced in lib/supplier/kyb.ts after parsing.
      bodySizeLimit: "32mb",
    },
  },
}

export default nextConfig
