FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./
# Bake the ~89 MB quantised CLIP weights into the image so boot never downloads.
RUN node -e "import('@huggingface/transformers').then(async ({pipeline}) => { await pipeline('image-feature-extraction', process.env.IMAGE_SEARCH_MODEL || 'Xenova/clip-vit-base-patch32', { dtype: 'q8' }); console.log('[model] baked'); })"
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
