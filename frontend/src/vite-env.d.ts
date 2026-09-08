/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly FLYT_SENTRY_DSN?: string;
  readonly FLYT_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
