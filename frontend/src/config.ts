const isLocalMode = import.meta.env.DEV || import.meta.env.MODE === 'test';
const DEFAULT_API_URL = isLocalMode ? 'http://localhost:8000' : undefined;

const envApiUrl = import.meta.env.FLYT_API_URL?.trim();

if (!envApiUrl && !isLocalMode) {
  throw new Error(`Missing FLYT_API_URL for mode "${import.meta.env.MODE}".`);
}

const rawApiUrl = envApiUrl ?? DEFAULT_API_URL;

if (!rawApiUrl) {
  throw new Error(`Missing FLYT_API_URL for mode "${import.meta.env.MODE}".`);
}

export const config = {
  apiUrl: rawApiUrl.replace(/\/+$/, ''),
};
