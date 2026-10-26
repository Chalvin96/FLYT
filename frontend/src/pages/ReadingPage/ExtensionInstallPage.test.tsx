import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ExtensionInstallPage } from './ExtensionInstallPage';

const originalUserAgent = navigator.userAgent;
function setUserAgent(value: string) {
  Object.defineProperty(navigator, 'userAgent', { value, configurable: true });
}

describe('ExtensionInstallPage', () => {
  afterEach(() => setUserAgent(originalUserAgent));

  it('test_install_page_given_unsupported_browser_expect_two_store_badges_and_plain_copy', () => {
    setUserAgent('Safari/120.0');
    render(<ExtensionInstallPage />);
    expect(screen.getAllByText('Coming soon')).toHaveLength(2);
    expect(
      screen.getAllByRole('heading', { name: 'Chrome Web Store' }),
    ).toHaveLength(1);
    expect(
      screen.getByRole('heading', { name: 'Microsoft Edge Add-ons' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Safari isn’t supported yet' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Manifest|packaging|deferred/),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([
    ['Chrome', 'Chrome/120.0 Safari/537.36', 'Chrome Web Store'],
    ['Edge', 'Chrome/120.0 Safari/537.36 Edg/120.0', 'Microsoft Edge Add-ons'],
  ])(
    'test_install_page_given_supported_browser_expect_one_detected_store_first',
    (browser, userAgent, store) => {
      setUserAgent(userAgent);
      render(<ExtensionInstallPage />);
      expect(screen.getByText(`You’re using ${browser}.`)).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 3 })[0]).toHaveTextContent(
        store,
      );
      expect(screen.getAllByText('Coming soon')).toHaveLength(2);
    },
  );
});
