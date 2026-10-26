import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MSG_RESULT_KIND, sendMessage } from '../lib/messages';

import { SearchView } from './SearchView';

vi.mock('../lib/messages', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/messages')>('../lib/messages');
  return { ...actual, sendMessage: vi.fn() };
});

beforeEach(() => {
  vi.mocked(sendMessage).mockReset();
});

describe('SearchView suggestion labels', () => {
  it('test_search_view_given_bracket_alternatives_expect_presented_label_with_canonical_accessible_name_and_selection', async () => {
    const canonical = 'få [stelle|lage] i stand';
    const onResolveWord = vi.fn();
    vi.mocked(sendMessage).mockResolvedValue({
      ok: true,
      kind: MSG_RESULT_KIND.SUGGESTIONS,
      data: [canonical],
    });

    render(
      <SearchView
        inputRef={null}
        initialQuery="få"
        onResolveWord={onResolveWord}
      />,
    );

    await userEvent.type(screen.getByRole('textbox'), '{Enter}');

    const option = await screen.findByRole('button', { name: canonical });
    expect(option).toHaveTextContent('få [stelle / lage] i stand');
    expect(option).not.toHaveTextContent(canonical);

    await userEvent.click(option);
    expect(onResolveWord).toHaveBeenCalledWith(canonical);
  });
});
