import { defineManifest } from '@crxjs/vite-plugin';

// host_permissions is scoped to the (build-time configurable) API origin - least privilege,
// since it both CORS-exempts the service worker and scopes the cookie read of the app's
// session JWT. "cookies" is the only auth permission: the extension reads the app's
// httpOnly session cookie and resends it as a Bearer header, never persisted (no `storage`,
// no `identity` - sign-in opens the app's own OAuth in a tab).
export default function manifestFactory(apiOrigin: string) {
  return defineManifest({
    manifest_version: 3,
    name: 'FlytLese — read & learn',
    version: '0.1.0',
    description:
      'Translate Norwegian text, look up words, and add vocabulary while reading.',
    permissions: ['cookies', 'contextMenus'],
    host_permissions: [`${apiOrigin}/*`],
    background: { service_worker: 'src/background/index.ts', type: 'module' },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['src/content/index.tsx'],
        run_at: 'document_idle',
      },
    ],
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    action: {
      default_title: 'Import this page to Flyt',
      default_icon: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png',
      },
    },
  });
}
