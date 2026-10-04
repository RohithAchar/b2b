# Image-search inference service

Long-running container that owns CLIP inference. The Vercel app never loads
the model; it POSTs validated uploads here and gets back a normalized
512-dim embedding, then runs the existing Supabase/pgvector search.

## Endpoints

- `GET /health` (or `/healthz`) — no auth: `{ ok, model, dim, warm }`
- `POST /embed` — `Authorization: Bearer <IMAGE_SEARCH_SERVICE_TOKEN>`,
  multipart field `image` (JPEG/PNG/WebP, ≤ 5 MB).
  Returns `{ embedding: number[512], model, dim }`.

## Env

| Var | Required | Description |
| --- | --- | --- |
| `IMAGE_SEARCH_SERVICE_TOKEN` | yes | Shared secret; Vercel sends it as Bearer, never the browser. Generate with `openssl rand -hex 32`. |
| `PORT` | no | Default `8000`. |
| `IMAGE_SEARCH_MODEL` | no | Default `Xenova/clip-vit-base-patch32`. Must match `IMAGE_EMBEDDING_MODEL` in `lib/ai/image-embeddings.ts` and the `product_image_embeddings.model` rows. |

## Run locally

```bash
cd services/image-search
pnpm install
IMAGE_SEARCH_SERVICE_TOKEN=dev-secret node src/server.js
# health
curl localhost:8000/health
# embed
curl -X POST localhost:8000/embed \
  -H "Authorization: Bearer dev-secret" \
  -F image=@/path/to/photo.jpg
```

First boot downloads ~89 MB of quantised weights into the Transformers.js
cache; subsequent boots/requests reuse them. The model loads once per process
and inference requests are serialised.

## Deploy (Fly.io example)

```bash
cd services/image-search
fly launch --name b2b-image-search --no-deploy
fly secrets set IMAGE_SEARCH_SERVICE_TOKEN=$(openssl rand -hex 32)
fly deploy
fly status
curl https://<app>.fly.dev/health
```

Then set on Vercel: `IMAGE_SEARCH_SERVICE_URL=https://<app>.fly.dev`,
`IMAGE_SEARCH_SERVICE_TOKEN=<same secret>`.

## Deploy (any Docker host)

```bash
cd services/image-search
docker build -t b2b-image-search .
docker run -p 8000:8000 -e IMAGE_SEARCH_SERVICE_TOKEN=$(openssl rand -hex 32) b2b-image-search
```

The Dockerfile bakes the weights in at build time so cold boots read from
disk instead of downloading.
