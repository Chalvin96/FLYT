import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ACCOUNT_PAGE_ANCHORS } from '@/components/nav/accountNavigation';

import { useAccountAnchorFocus } from './useAccountAnchorFocus';

function AnchorHarness({
  id,
  showTarget,
}: {
  id: string;
  showTarget: boolean;
}) {
  useAccountAnchorFocus();

  return showTarget ? (
    <h2 id={id} tabIndex={-1}>
      Account section
    </h2>
  ) : null;
}

function ReplacementHarness({ id, loaded }: { id: string; loaded: boolean }) {
  useAccountAnchorFocus();

  return loaded ? (
    <h2 id={id} key="loaded" tabIndex={-1}>
      Loaded section
    </h2>
  ) : (
    <h2 id={id} key="loading" tabIndex={-1}>
      Loading section
    </h2>
  );
}

afterEach(() => {
  window.location.hash = '';
});

describe('useAccountAnchorFocus', () => {
  it('test_account_anchor_focus_given_existing_hash_target_expect_heading_focused', () => {
    window.location.hash = `#${ACCOUNT_PAGE_ANCHORS.CHATGPT}`;

    render(<AnchorHarness id={ACCOUNT_PAGE_ANCHORS.CHATGPT} showTarget />);

    expect(
      screen.getByRole('heading', { name: 'Account section' }),
    ).toHaveFocus();
  });

  it('test_account_anchor_focus_given_same_page_hash_change_expect_heading_focused', () => {
    render(<AnchorHarness id={ACCOUNT_PAGE_ANCHORS.CHATGPT} showTarget />);

    window.location.hash = `#${ACCOUNT_PAGE_ANCHORS.CHATGPT}`;
    window.dispatchEvent(new Event('hashchange'));

    expect(
      screen.getByRole('heading', { name: 'Account section' }),
    ).toHaveFocus();
  });

  it('test_account_anchor_focus_given_late_hash_target_expect_focus_after_mount', async () => {
    window.location.hash = `#${ACCOUNT_PAGE_ANCHORS.PROVIDER_KEY}`;

    const view = render(
      <AnchorHarness
        id={ACCOUNT_PAGE_ANCHORS.PROVIDER_KEY}
        showTarget={false}
      />,
    );

    view.rerender(
      <AnchorHarness id={ACCOUNT_PAGE_ANCHORS.PROVIDER_KEY} showTarget />,
    );

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Account section' }),
      ).toHaveFocus(),
    );
  });

  it.each([
    ['chatbot', ACCOUNT_PAGE_ANCHORS.CHATGPT],
    ['provider key', ACCOUNT_PAGE_ANCHORS.PROVIDER_KEY],
  ])(
    'test_account_anchor_focus_given_loading_heading_replaced_by_loaded_section_expect_focus_on_final_heading',
    async (_label, id) => {
      // replaceState updates the hash without queuing jsdom's async hashchange,
      // so this exercises only the async loading-to-loaded DOM replacement.
      window.history.replaceState(null, '', `#${id}`);

      const view = render(<ReplacementHarness id={id} loaded={false} />);

      const loadingHeading = screen.getByRole('heading', {
        name: 'Loading section',
      });
      expect(loadingHeading).toHaveFocus();

      view.rerender(<ReplacementHarness id={id} loaded />);

      await waitFor(() =>
        expect(
          screen.getByRole('heading', { name: 'Loaded section' }),
        ).toHaveFocus(),
      );
      expect(loadingHeading).not.toBeInTheDocument();
    },
  );
});
