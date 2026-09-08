export function buildHref(to: string, search?: Record<string, string>) {
  return search && Object.keys(search).length > 0
    ? `${to}?${new URLSearchParams(search).toString()}`
    : to;
}
