FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.12.10 /uv /uvx /bin/

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY . .
RUN uv sync --frozen --no-dev


FROM python:3.12-slim

WORKDIR /app

RUN useradd -m -u 10001 svc

COPY --from=builder --chown=svc:svc /app /app

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    ENV=production

# Bake release id (e.g. `flyt@<git-sha>`) at CI build time so Sentry groups by
# commit. Default `dev` keeps a plain `docker build` working. ARG/ENV must live
# in this final stage — settings.RELEASE reads the runtime env of THIS image.
ARG RELEASE=dev
ENV RELEASE=$RELEASE

COPY --chown=svc:svc docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod 755 /docker-entrypoint.sh

USER svc

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health/live',timeout=3).status==200 else 1)"

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["uvicorn", "flyt.main:app", "--host", "0.0.0.0", "--port", "8000"]
