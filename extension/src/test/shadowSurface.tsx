import type { ShadowSurface } from '@flyt/ui';

export function createTestShadowSurface(): ShadowSurface {
  const container = document.createElement('div');
  const reactHost = document.createElement('div');
  container.append(reactHost);
  return {
    container,
    reactHost,
    PortalSurface: ({ children }) => (
      <div data-testid="portal-surface">{children}</div>
    ),
  };
}
