import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logClientError, showApiError } from './errors';

const originalReportError = (window as Window & { reportError?: unknown })
  .reportError;
const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: toastErrorMock },
}));

afterEach(() => {
  vi.restoreAllMocks();

  if (originalReportError === undefined) {
    Reflect.deleteProperty(
      window as Window & { reportError?: unknown },
      'reportError',
    );
    return;
  }

  (window as Window & { reportError?: unknown }).reportError =
    originalReportError;
});

describe('logClientError', () => {
  it('uses window.reportError when available', () => {
    const reportError = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    (window as Window & { reportError?: unknown }).reportError = reportError;

    logClientError('route error', 'Boom');

    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledWith(new Error('Boom'));
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('preserves object error as cause when using window.reportError', () => {
    const reportError = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    (window as Window & { reportError?: unknown }).reportError = reportError;

    logClientError('route error', { code: 42 });

    expect(reportError).toHaveBeenCalledOnce();

    const reportedError = reportError.mock.calls[0][0] as Error & {
      cause?: unknown;
    };

    expect(reportedError).toBeInstanceOf(Error);
    expect(reportedError.message).toBe('route error');
    expect(reportedError.cause).toEqual({ code: 42 });
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('falls back to console.error when window.reportError is unavailable', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    Reflect.deleteProperty(
      window as Window & { reportError?: unknown },
      'reportError',
    );

    logClientError('route error', { code: 42 });

    expect(consoleSpy).toHaveBeenCalledOnce();

    const fallbackError = consoleSpy.mock.calls[0][1] as Error & {
      cause?: unknown;
    };

    expect(consoleSpy.mock.calls[0][0]).toBe('route error');
    expect(fallbackError).toBeInstanceOf(Error);
    expect(fallbackError.message).toBe('route error');
    expect(fallbackError.cause).toEqual({ code: 42 });
  });
});

describe('showApiError', () => {
  beforeEach(() => {
    (window as Window & { reportError?: unknown }).reportError = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows generic message when error is not axios', () => {
    showApiError(new Error('unknown'));

    expect(toastErrorMock).toHaveBeenCalledOnce();
    expect(toastErrorMock.mock.calls[0][0]).toBe(
      'Something went wrong. Please try again.',
    );
    expect(toastErrorMock.mock.calls[0][1]).toEqual({
      description: 'unknown',
    });
  });

  it('shows backend detail.message as line 2', () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 500,
        data: {
          detail: {
            code: 'INTERNAL_ERROR',
            message: 'Database connection failed',
          },
        },
      },
    };

    showApiError(axiosError);

    expect(toastErrorMock).toHaveBeenCalledOnce();
    expect(toastErrorMock.mock.calls[0][0]).toBe(
      'Something went wrong. Please try again.',
    );
    expect(toastErrorMock.mock.calls[0][1]).toEqual({
      description: 'Database connection failed',
    });
  });

  it('shows first validation error for 422 responses', () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 422,
        data: {
          detail: [
            { msg: 'Field is required', loc: ['body', 'name'] },
            { msg: 'Invalid format', loc: ['body', 'email'] },
          ],
        },
      },
    };

    showApiError(axiosError);

    expect(toastErrorMock).toHaveBeenCalledOnce();
    expect(toastErrorMock.mock.calls[0][0]).toBe(
      'Something went wrong. Please try again.',
    );
    expect(toastErrorMock.mock.calls[0][1]).toEqual({
      description: 'Field is required',
    });
  });

  it('omits line 2 when detail message is missing', () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 500,
        data: {
          detail: {
            code: 'INTERNAL_ERROR',
          },
        },
      },
    };

    showApiError(axiosError);

    expect(toastErrorMock).toHaveBeenCalledOnce();
    expect(toastErrorMock.mock.calls[0][0]).toBe(
      'Something went wrong. Please try again.',
    );
    expect(toastErrorMock.mock.calls[0][1]).toEqual({
      description: undefined,
    });
  });

  it('logs code internally but does not show it in toast', () => {
    const reportError = vi.fn();
    (window as Window & { reportError?: unknown }).reportError = reportError;

    const axiosError = {
      isAxiosError: true,
      response: {
        status: 500,
        data: {
          detail: {
            code: 'DB_FAILURE',
            message: 'Database error',
          },
        },
      },
    };

    showApiError(axiosError);

    expect(toastErrorMock.mock.calls[0][0]).toBe(
      'Something went wrong. Please try again.',
    );
    expect(toastErrorMock.mock.calls[0][1]).toEqual({
      description: 'Database error',
    });

    expect(reportError).toHaveBeenCalledOnce();
    expect((reportError.mock.calls[0][0] as Error).message).toContain(
      'DB_FAILURE',
    );
  });

  it('shows plain string detail as toast description', () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          detail: 'Invalid query characters',
        },
      },
    };

    showApiError(axiosError);

    expect(toastErrorMock).toHaveBeenCalledOnce();
    expect(toastErrorMock.mock.calls[0][0]).toBe(
      'Something went wrong. Please try again.',
    );
    expect(toastErrorMock.mock.calls[0][1]).toEqual({
      description: 'Invalid query characters',
    });
  });

  it('uses plain Error messages as the toast description', () => {
    showApiError(new Error('Unable to load this dictionary entry.'));

    expect(toastErrorMock).toHaveBeenCalledOnce();
    expect(toastErrorMock.mock.calls[0][0]).toBe(
      'Something went wrong. Please try again.',
    );
    expect(toastErrorMock.mock.calls[0][1]).toEqual({
      description: 'Unable to load this dictionary entry.',
    });
  });
});
