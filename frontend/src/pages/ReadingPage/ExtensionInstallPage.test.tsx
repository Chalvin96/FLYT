import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import { ExtensionInstallPage } from './ExtensionInstallPage';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

function setUserAgent(value: string) {
  Object.defineProperty(navigator, 'userAgent', {
    value,
    configurable: true,
  });
}

const REAL_UA = navigator.userAgent;

describe('ExtensionInstallPage', () => {
  afterEach(() => setUserAgent(REAL_UA));

  it('test_extension_install_page_given_supported_browsers_expect_chromium_links_and_other_browsers_deferred', () => {
    render(<ExtensionInstallPage />);

    for (const browser of ['Chrome', 'Edge']) {
      expect(
        screen.getByRole('heading', { name: browser }),
      ).toBeInTheDocument();
    }

    for (const store of ['Chrome Web Store', 'Microsoft Edge Add-ons']) {
      // Store listings are unpublished: the link renders as a disabled button.
      expect(
        screen.getByRole('button', {
          name: new RegExp(`${store} link coming soon`, 'i'),
        }),
      ).toBeDisabled();
    }

    expect(
      screen.getByRole('heading', { name: 'Safari is not yet supported' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /one Chromium Manifest V3 build serves Chrome and Edge/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Firefox and Safari are not supported yet/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Firefox' }),
    ).not.toBeInTheDocument();
  });

  it('test_extension_install_page_given_chrome_user_agent_expect_chrome_led', () => {
    setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    );
    render(<ExtensionInstallPage />);

    expect(screen.getByText(/we detected Chrome/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /coming to Chrome/i }),
    ).toBeInTheDocument();
  });

  it('test_extension_install_page_given_edge_user_agent_expect_edge_led_not_chrome', () => {
    // Edge's UA also contains "Chrome"; detection must prefer Edge.
    setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0',
    );
    render(<ExtensionInstallPage />);

    expect(screen.getByText(/we detected Edge/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /coming to Edge/i }),
    ).toBeInTheDocument();
  });
});
