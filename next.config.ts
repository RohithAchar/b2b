import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
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
  // The CLIP weights in `models/` (~85 MB) are read at runtime through a
  // filesystem path built in lib/ai/image-model-source.ts. Next's tracer
  // currently resolves those paths on its own, but without this a tracer
  // change would silently ship a function that falls back to a ~935 s download
  // on every cold start. Listed explicitly to make the dependency intentional.
  //
  // `pnpm embeddings:fetch-model` populates the directory; `prebuild` runs it.
  // Every route that reaches the model must be listed here: the buyer search
  // endpoint, and the supplier product pages that index images on save.
  outputFileTracingIncludes: {
    "/api/search/image": ["./models/**/*"],
    "/supplier/dashboard/products": ["./models/**/*"],
    "/supplier/dashboard/products/new": ["./models/**/*"],
    "/supplier/dashboard/products/[id]/edit": ["./models/**/*"],
  },
}

export default nextConfig