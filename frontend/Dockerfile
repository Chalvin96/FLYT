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
# Bake release id at CI build time so Sentry groups frontend errors by commit.
# Vite reads FLYT_RELEASE from the build process env (envPrefix allows FLYT_).
ARG FLYT_RELEASE=dev
RUN FLYT_API_URL=__FLYT_API_URL__ FLYT_RELEASE=$FLYT_RELEASE pnpm --filter frontend build

# Unprivileged nginx: runs as uid 101, listens on 8080.
FROM nginxinc/nginx-unprivileged:alpine

USER root
# chown so uid 101 can rewrite the API URL placeholder in the built JS at runtime.
COPY --from=builder --chown=101:101 /repo/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod 755 /docker-entrypoint.sh \
    && chmod 644 /etc/nginx/conf.d/default.conf
USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
