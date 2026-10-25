import { defineManifest } from '@crxjs/vite-plugin';

import { version } from '../package.json';

export default function manifestFactory(
  apiOrigin: string,
  browser: 'chrome' | 'firefox',
) {
  return defineManifest({
    manifest_version: 3,
    name: 'FlytLese — read & learn',
    version,
    description:
      'Translate Norwegian text, look up words, and add vocabulary while reading.',
    permissions: ['cookies', 'contextMenus'],
    host_permissions: [`${apiOrigin}/*`],
    options_ui: { page: 'src/options/index.html', open_in_tab: true },
    background:
      browser === 'firefox'
        ? { scripts: ['src/background/index.ts'] }
        : { service_worker: 'src/background/index.ts', type: 'module' },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'flytlese@flyt.umebocchi.my.id',
          strict_min_version: '142.0',
          data_collection_permissions: {
            required: [
              'authenticationInfo',
              'browsingActivity',
              'searchTerms',
              'websiteContent',
            ],
          },
        },
      },
    }),
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
