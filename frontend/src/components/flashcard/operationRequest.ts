export const K_OPERATION_REQUEST_TIMEOUT_MS = 30_000;

export function withOperationTimeout<T>(
  request: Promise<T>,
  timeoutMs = K_OPERATION_REQUEST_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(new Error('Operation request timed out'));
    }, timeoutMs);

    request.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
