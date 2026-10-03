import type { NextConfig } from "next"

/**
 * The CLIP weights in `models/` (~85 MB) are read at runtime through a
 * filesystem path built in lib/ai/image-model-source.ts. Next's tracer
 * currently resolves those paths on its own, but without this a tracer
 * change would silently ship a function that falls back to a ~935 s download
 * on every cold start. Listed explicitly to make the dependency intentional.
 *
 * `pnpm embeddings:fetch-model` populates the directory; `prebuild` runs it.
 */
const IMAGE_MODEL_WEIGHTS = ["./models/**/*"]

/**
 * Native binaries for the same routes, which the tracer cannot see because no
 * reachable `require()` names them. Without these the deployed function reaches
 * `/api/search/image` and then dies inside `@huggingface/transformers`:
 *
 *   - libvips: `@img/sharp-linux-x64/index.cjs` only `require.resolve`s it, and
 *     `sharp.node` resolves its DT_NEEDED `libvips-cpp.so.<version>` through its
 *     own DT_RPATH. Untraced, the endpoint fails with
 *     `ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.7: cannot open shared object file`.
 *   - onnxruntime-node: it is in Next's default `serverExternalPackages`, so
 *     Turbopack externalises it and never traces it. Transformers.js reaches it
 *     with `requireFromHere("onnxruntime-node")`, so the bare specifier has to
 *     resolve from `node_modules/.pnpm/@huggingface+transformers@.../` — which
 *     needs the package present at the *root* `node_modules` (pnpm only hoists
 *     transitive dependencies into `node_modules/.pnpm/node_modules`), and needs
 *     `package.json`, because that is what `main: dist/index.js` resolution and
 *     ESM bare-specifier resolution both read. Shipping just the `.js` files got
 *     the deployed function as far as `Cannot find module 'onnxruntime-node'`.
 *     `dist/binding.js` then requires the binding through a template literal
 *     (`../bin/napi-v6/${process.platform}/${process.arch}/`), which no tracer
 *     can follow.
 *
 * Linux x64 glibc only — the Vercel Node runtime, and what
 * `supportedArchitectures` in pnpm-workspace.yaml installs. The CUDA/TensorRT
 * provider libraries next to the binding (~260 MB) are never dlopen'd on the
 * CPU execution provider and are deliberately left out, as are the darwin and
 * win32 trees: `bin/napi-v6` is 506 MB across platforms. The CPU library and the
 * binding resolve each other through a `$ORIGIN` RUNPATH, so they ship together.
 *
 * libvips is named by its pnpm store directory because Sharp resolves it from
 * inside `@img/sharp-<platform>`, where the hoisted
 * `node_modules/.pnpm/node_modules` link is what reaches it. onnxruntime-node is
 * named through the root link instead, so the deployed tree keeps a package
 * that `require("onnxruntime-node")` can actually find. Note that any include
 * matching inside `node_modules` moves the route off Turbopack's lean trace onto
 * the full `@vercel/nft` analysis, which costs ~2 MB of extra JavaScript here.
 */
const IMAGE_SEARCH_NATIVE_DEPS = [
  "./node_modules/.pnpm/@img+sharp-libvips-linux-x64@*/node_modules/@img/sharp-libvips-linux-x64/lib/*.so*",
  "./node_modules/onnxruntime-node/package.json",
  "./node_modules/onnxruntime-node/dist/**/*.js",
  "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/{onnxruntime_binding.node,libonnxruntime.so.1,libonnxruntime_providers_shared.so}",
  // onnxruntime-common is required by onnxruntime-node's CJS build
  // (`require("onnxruntime-common")` from dist/binding.js), which resolves the
  // package's `main` condition — dist/cjs/index.js. The tracer only follows the
  // ESM graph, so without this the deployed function dies one level past
  // onnxruntime-node with "Cannot find module
  // '.../onnxruntime-common/dist/cjs/index.js'".
  "./node_modules/.pnpm/node_modules/onnxruntime-common/dist/cjs/**/*.js",
]

/**
 * Every route that reaches the model must list both sets: the buyer search
 * endpoint, and the supplier product pages that index images on save.
 *
 * `sharp`, `onnxruntime-node` and `@huggingface/transformers` are already in
 * Next's default `serverExternalPackages` list, so Turbopack externalises them
 * (`.next/node_modules/sharp-<hash>`) instead of bundling them — which is why
 * these entries, not a bundler setting, are what keeps the binaries usable.
 */
const IMAGE_MODEL_ROUTES = [
  "/api/search/image",
  "/supplier/dashboard/products",
  "/supplier/dashboard/products/new",
  "/supplier/dashboard/products/[id]/edit",
]

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
  outputFileTracingIncludes: Object.fromEntries(
    IMAGE_MODEL_ROUTES.map((route) => [route, [...IMAGE_MODEL_WEIGHTS, ...IMAGE_SEARCH_NATIVE_DEPS]]),
  ),
}

export default nextConfig