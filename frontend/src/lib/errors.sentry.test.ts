import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logClientError } from './errors';

const { sentryCaptureExceptionMock, sentryGetClientMock } = vi.hoisted(() => ({
  sentryCaptureExceptionMock: vi.fn(),
  sentryGetClientMock: vi.fn(),
}));

vi.mock('@sentry/react', () => ({
  captureException: sentryCaptureExceptionMock,
  getClient: sentryGetClientMock,
}));

describe('logClientError Sentry integration', () => {
  beforeEach(() => {
    sentryCaptureExceptionMock.mockReset();
    sentryGetClientMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls Sentry.captureException when Sentry is initialized', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    sentryGetClientMock.mockReturnValue({});

    logClientError('route error', 'Boom');

    expect(sentryCaptureExceptionMock).toHaveBeenCalledOnce();
    expect(sentryCaptureExceptionMock).toHaveBeenCalledWith(new Error('Boom'), {
      tags: {},
      extra: {},
    });
  });

  it('logs to console.error on the Sentry path for local repro', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sentryGetClientMock.mockReturnValue({});

    logClientError('route error', 'Boom');

    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(consoleSpy.mock.calls[0][0]).toBe('route error');
  });

  it('sanitizes AxiosError before sending to Sentry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    sentryGetClientMock.mockReturnValue({});

    const axiosError = {
      isAxiosError: true,
      message: 'Request failed with status code 500',
      config: {
        method: 'post',
        url: '/api/auth/callback?code=SECRET&state=x',
        headers: { Authorization: 'Bearer secret-token' },
        data: { password: 'hunter2' },
      },
      response: {
        status: 500,
        data: {
          detail: { code: 'INTERNAL_ERROR', message: 'DB down' },
        },
      },
    };

    logClientError('API call failed', axiosError);

    expect(sentryCaptureExceptionMock).toHaveBeenCalledOnce();
    const [capturedError, captureContext] =
      sentryCaptureExceptionMock.mock.calls[0];
    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError.message).toBe('API call failed');
    // No headers / bodies leaked onto the captured Error.
    expect(capturedError).not.toHaveProperty('config');
    expect(capturedError).not.toHaveProperty('response');
    expect(captureContext.tags).toEqual({
      http_status: 500,
      api_code: 'INTERNAL_ERROR',
      http_method: 'post',
    });
    // Query string and fragment are stripped so OAuth codes / tokens / PII
    // cannot leak via extra.url.
    expect(captureContext.extra).toEqual({ url: '/api/auth/callback' });
    expect(captureContext.extra.url).not.toContain('SECRET');
    expect(captureContext.extra.url).not.toContain('code=');
  });

  it('logs the sanitized error (not the raw AxiosError) on the Sentry path', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sentryGetClientMock.mockReturnValue({});

    const axiosError = {
      isAxiosError: true,
      message: 'Request failed with status code 500',
      config: {
        method: 'post',
        url: '/api/login',
        headers: { Authorization: 'Bearer secret-token' },
        data: { password: 'hunter2' },
      },
      response: {
        status: 500,
        data: { detail: { code: 'INTERNAL_ERROR', message: 'DB down' } },
      },
    };

    logClientError('API call failed', axiosError);

    expect(consoleSpy).toHaveBeenCalledOnce();
    const [loggedMessage, loggedError] = consoleSpy.mock.calls[0];
    expect(loggedMessage).toBe('API call failed');
    // The logged error is the sanitized payload.error, not the raw AxiosError.
    expect(loggedError).toBeInstanceOf(Error);
    expect(loggedError).not.toBe(axiosError);
    expect(loggedError).not.toHaveProperty('config');
    expect(loggedError).not.toHaveProperty('response');
  });

  it('does not call Sentry.captureException when Sentry is not initialized', () => {
    sentryGetClientMock.mockReturnValue(undefined);

    const reportError = vi.fn();
    (window as Window & { reportError?: unknown }).reportError = reportError;

    logClientError('route error', 'Boom');

    expect(sentryCaptureExceptionMock).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalled();
  });

  it('preserves object error as cause when capturing to Sentry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    sentryGetClientMock.mockReturnValue({});

    logClientError('route error', { code: 42 });

    expect(sentryCaptureExceptionMock).toHaveBeenCalledOnce();

    const capturedError = sentryCaptureExceptionMock.mock
      .calls[0][0] as Error & {
      cause?: unknown;
    };

    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError.message).toBe('route error');
    expect(capturedError.cause).toEqual({ code: 42 });
  });
});
