import { afterEach, describe, expect, it, vi } from 'vitest';

import { openLogin, readSessionToken } from './auth';

// chrome.cookies.get is overloaded; spyOn resolves to the callback form, whose
// return type is void. This alias selects the promise form the code calls.
const cookies = chrome.cookies as {
  get(details: chrome.cookies.CookieDetails): Promise<chrome.cookies.Cookie | null>;
};

afterEach(() => vi.restoreAllMocks());

describe('readSessionToken', () => {
  it('test_read_session_token_given_cookie_present_expect_value', async () => {
    const get = vi
      .spyOn(cookies, 'get')
      .mockResolvedValue({ value: 'jwt-123' } as chrome.cookies.Cookie);

    await expect(readSessionToken()).resolves.toBe('jwt-123');
    expect(get).toHaveBeenCalledWith({
      url: 'http://localhost:8000',
      name: 'access_token',
    });
  });

  it('test_read_session_token_given_no_cookie_expect_null', async () => {
    vi.spyOn(cookies, 'get').mockResolvedValue(null);

    await expect(readSessionToken()).resolves.toBeNull();
  });

  it('test_read_session_token_given_every_call_expect_fresh_read', async () => {
    const get = vi
      .spyOn(cookies, 'get')
      .mockResolvedValue({ value: 'jwt-123' } as chrome.cookies.Cookie);
    get.mockClear();

    await readSessionToken();
    await readSessionToken();

    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe('openLogin', () => {
  it('test_open_login_given_call_expect_oauth_start_tab', async () => {
    const create = vi
      .spyOn(chrome.tabs, 'create')
      .mockResolvedValue(undefined as never);

    await openLogin();

    expect(create).toHaveBeenCalledWith({
      url: 'http://localhost:8000/users/oauth/google/start',
    });
  });
});
