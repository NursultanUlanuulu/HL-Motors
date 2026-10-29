FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit

FROM dependencies AS build
COPY . .
ARG MEDIA_PUBLIC_URL
ENV MEDIA_PUBLIC_URL=$MEDIA_PUBLIC_URL NEXT_TELEMETRY_DISABLED=1
# Only select the PostgreSQL data mode at build time; no live credentials in layers.
RUN DATABASE_URL=postgresql://build:build@localhost/build npm run build

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev --no-audit

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json /app/next.config.ts ./
COPY --from=build /app/scripts/postgres-migrate.cjs /app/scripts/postgres-bootstrap.cjs ./scripts/
COPY --from=build /app/scripts/video-worker.cjs ./scripts/
COPY --from=build /app/supabase/migrations ./supabase/migrations
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]
