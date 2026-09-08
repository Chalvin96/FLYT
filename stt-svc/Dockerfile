FROM python:3.12-slim AS model-builder

COPY --from=ghcr.io/astral-sh/uv:0.12.10 /uv /uvx /bin/

ARG MODEL_ID=NbAiLab/nb-whisper-medium
ARG MODEL_REVISION=0ed074d5985bd56ca4140159a9dbffbc3fb5117e
ARG TORCH_VERSION=2.9.1+cpu
ARG MODEL_BUNDLE_URL
ARG MODEL_BUNDLE_SHA256=c079d580abcfec05891c3b751dd1d697cb93abf7f6c1561c2dc8035c0e2894b9

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONUNBUFFERED=1

COPY scripts/fetch_model_bundle.py /tmp/fetch_model_bundle.py

RUN if [ -n "${MODEL_BUNDLE_URL}" ]; then \
      python /tmp/fetch_model_bundle.py \
        --url "${MODEL_BUNDLE_URL}" \
        --sha256 "${MODEL_BUNDLE_SHA256}" \
        --output /tmp/model-bundle.tar.gz \
        --extract-to /models \
      && rm /tmp/model-bundle.tar.gz; \
    else \
      python -m pip install --no-cache-dir \
        --extra-index-url https://download.pytorch.org/whl/cpu \
        "torch==${TORCH_VERSION}" \
      && python -m pip install --no-cache-dir \
        "ctranslate2==4.8.1" \
        "transformers==5.14.1" \
      && mkdir -p /models \
      && ct2-transformers-converter \
        --model "${MODEL_ID}" \
        --revision "${MODEL_REVISION}" \
        --output_dir /models/nb-whisper-medium-int8 \
        --copy_files tokenizer.json preprocessor_config.json \
        --quantization int8; \
    fi


FROM python:3.12-slim AS runtime

COPY --from=ghcr.io/astral-sh/uv:0.12.10 /uv /uvx /bin/

ARG MODEL_REVISION=0ed074d5985bd56ca4140159a9dbffbc3fb5117e

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HUB_OFFLINE=1 \
    STT_MODEL_PATH=/models/nb-whisper-medium-int8 \
    STT_MODEL_REVISION=${MODEL_REVISION}

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH=/app/.venv/bin:$PATH

COPY pyproject.toml uv.lock /app/
RUN uv sync --frozen --no-dev --no-install-project

COPY --from=model-builder /models/nb-whisper-medium-int8 /models/nb-whisper-medium-int8
COPY app.py exceptions.py NOTICE.md Apache-2.0.txt /app/

RUN useradd --create-home --uid 10001 svc \
    && chown -R svc:svc /app /models
USER svc

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health/ready', timeout=3)"

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
