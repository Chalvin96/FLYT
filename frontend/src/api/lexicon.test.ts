import { describe, expect, it, vi } from 'vitest';

import { client } from '@/api/client';
import { getSuggestions } from '@/api/lexicon';

vi.mock('@/api/client', () => ({
  client: {
    get: vi.fn(),
  },
}));

describe('lexicon api', () => {
  it('sends only query param for suggestions lookup', async () => {
    const getMock = vi.mocked(client.get);
    getMock.mockResolvedValueOnce({
      data: { suggestions: [{ label: 'kjore' }] },
    });

    const result = await getSuggestions('kjore');

    expect(getMock).toHaveBeenCalledWith('/lexicons/suggestions', {
      params: {
        query: 'kjore',
      },
    });
    expect(result).toEqual({ suggestions: [{ label: 'kjore' }] });
  });
});
