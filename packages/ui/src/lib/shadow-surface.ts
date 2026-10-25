import { createContext, createElement, useContext } from 'react';
import type { ReactElement, ReactNode } from 'react';

const PortalContainer = createContext<HTMLElement | null>(null);

export function usePortalContainer(): HTMLElement {
  return useContext(PortalContainer) ?? document.body;
}

export type ShadowSurface = {
  container: HTMLDivElement;
  reactHost: HTMLDivElement;
  PortalSurface: (props: { children: ReactNode }) => ReactElement;
};

export function createShadowSurface(
  css: string,
  { mode = 'closed' }: { mode?: ShadowRootMode } = {},
): ShadowSurface {
  const container = document.createElement('div');
  const shadow = container.attachShadow({ mode });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  shadow.adoptedStyleSheets = [sheet];

  const reactHost = document.createElement('div');
  const portalSurface = document.createElement('div');
  shadow.append(reactHost, portalSurface);

  const PortalSurface = ({ children }: { children: ReactNode }) =>
    createElement(PortalContainer.Provider, { value: portalSurface }, children);

  return { container, reactHost, PortalSurface };
}
