FROM node:24-slim AS builder

RUN corepack enable && corepack prepare pnpm@12.3.4 --activate

WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY scripts/check_pnpm_version.mjs scripts/check_pnpm_version.mjs
COPY packages/ui/package.json packages/ui/package.json
COPY packages/lexicon/package.json packages/lexicon/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile --filter frontend...

COPY packages/ui packages/ui
COPY packages/lexicon packages/lexicon
COPY frontend frontend
# Bake the deployment's backend URL and release id into the static frontend.
# Vite reads FLYT_* values from the build process env.
ARG FLYT_API_URL
ARG FLYT_SENTRY_DSN
ARG FLYT_RELEASE=dev
RUN FLYT_API_URL=$FLYT_API_URL FLYT_SENTRY_DSN=$FLYT_SENTRY_DSN FLYT_RELEASE=$FLYT_RELEASE pnpm --filter frontend build

# Unprivileged nginx: runs as uid 101, listens on 8080.
FROM nginxinc/nginx-unprivileged:alpine

USER root
COPY --from=builder --chown=101:101 /repo/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
RUN chmod 644 /etc/nginx/conf.d/default.conf
USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
