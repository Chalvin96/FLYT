import '@testing-library/jest-dom';

import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { server } from './msw/server';

window.scrollTo = vi.fn();

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// Without `error`, an unmatched request reaches a real socket and hangs.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
