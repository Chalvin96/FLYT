// Auth = reuse the web app's login session: read its httpOnly JWT cookie via chrome.cookies
// and resend it as a Bearer header (sidesteps SameSite=Lax). Never cached - read fresh each
// call, since the SW sleeps and cookie maxAge != JWT exp.

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:8000';
const LOGIN_URL = `${API_ORIGIN}/users/oauth/google/start`;

export async function readSessionToken(): Promise<string | null> {
  const cookie = await chrome.cookies.get({ url: API_ORIGIN, name: 'access_token' });
  return cookie?.value ?? null;
}

export async function openLogin(): Promise<void> {
  await chrome.tabs.create({ url: LOGIN_URL });
}
