import { describe, expect, it, vi } from 'vitest';

import manifestFactory from './manifest.config';

vi.mock('../package.json', () => ({ version: '2.3.4' }));

const API_ORIGIN = 'https://api.flyt.umebocchi.my.id';

describe('manifest', () => {
  it('test_manifest_given_chrome_expect_package_version_and_service_worker', async () => {
    const manifest = await manifestFactory(API_ORIGIN, 'chrome');

    expect(manifest).toMatchObject({
      version: '2.3.4',
      host_permissions: [`${API_ORIGIN}/*`],
      options_ui: { page: 'src/options/index.html', open_in_tab: true },
      background: { service_worker: 'src/background/index.ts', type: 'module' },
    });
    expect(manifest).not.toHaveProperty('browser_specific_settings');
  });

  it('test_manifest_given_firefox_expect_gecko_identity_consent_and_background_scripts', async () => {
    const manifest = await manifestFactory(API_ORIGIN, 'firefox');

    expect(manifest).toMatchObject({
      version: '2.3.4',
      host_permissions: [`${API_ORIGIN}/*`],
      options_ui: { page: 'src/options/index.html', open_in_tab: true },
      background: { scripts: ['src/background/index.ts'] },
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
    });
    expect(manifest).not.toHaveProperty('background.service_worker');
  });
});
