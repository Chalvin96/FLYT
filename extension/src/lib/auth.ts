import { hasApiPermission } from './permissions';

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:8000';
const LOGIN_URL = `${API_ORIGIN}/users/oauth/google/start`;

export async function readSessionToken(): Promise<string | null> {
  if (!(await hasApiPermission())) return null;
  const cookie = await chrome.cookies.get({
    url: API_ORIGIN,
    name: 'access_token',
  });
  return cookie?.value ?? null;
}

export async function openLogin(): Promise<void> {
  await chrome.tabs.create({ url: LOGIN_URL });
}
