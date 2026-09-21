FROM node:24-bookworm-slim AS base
ENV HUSKY=0
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@10.32.1
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile && pnpm generate

FROM deps AS dev
COPY . .
CMD ["pnpm", "start:dev"]

FROM deps AS build
COPY . .
RUN pnpm build && pnpm prune --prod

FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json /app/prisma.config.ts ./
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
