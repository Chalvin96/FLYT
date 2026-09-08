import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Minimal MV3 `chrome` API mock. The background/content modules register
// listeners at import time; these stubs let them import under jsdom without a
// real extension runtime. Individual tests override members as needed.
const chromeMock = {
  runtime: {
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
    sendMessage: vi.fn(),
    getURL: (path: string) => `chrome-extension://test/${path}`,
    lastError: undefined as { message: string } | undefined,
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    create: vi.fn(),
  },
  contextMenus: {
    create: vi.fn(),
    removeAll: vi.fn((callback?: () => void) => callback?.()),
    onClicked: { addListener: vi.fn() },
  },
  action: {
    onClicked: { addListener: vi.fn() },
  },
  cookies: {
    get: vi.fn(),
  },
  storage: {
    local: { get: vi.fn(), set: vi.fn() },
  },
};

vi.stubGlobal('chrome', chromeMock);
