export const API_PERMISSION_MESSAGE =
  'Click the FlytLese toolbar button to allow access to Flyt.';

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:8000';
const API_PERMISSION = { origins: [`${API_ORIGIN}/*`] };
const SITE_ACCESS_PERMISSION = { origins: ['<all_urls>', `${API_ORIGIN}/*`] };

export function hasApiPermission(): Promise<boolean> {
  return chrome.permissions.contains(API_PERMISSION);
}

export async function requestApiPermission(): Promise<{ granted: boolean }> {
  const granted = await chrome.permissions.request(API_PERMISSION);
  return { granted };
}

export function hasSiteAccess(): Promise<boolean> {
  return chrome.permissions.contains(SITE_ACCESS_PERMISSION);
}

export async function requestSiteAccess(): Promise<{ granted: boolean }> {
  const granted = await chrome.permissions.request(SITE_ACCESS_PERMISSION);
  return { granted };
}
