// Processed by @tailwindcss/postcss at build time: Tailwind utilities + @flyt/ui tokens +
// popup component styles, all inlined as a string for shadow-root injection.
import shadowCss from '../../tailwind/index.css?inline';

// A closed shadow root with the design-system CSS injected. Bridges :root token
// declarations to :host so var(--card)/etc. resolve inside the shadow tree.
// Production keeps the root closed; the E2E build opens it for assertions.
const SHADOW_MODE: ShadowRootMode =
  import.meta.env.VITE_E2E_HOOKS === 'true' ? 'open' : 'closed';

export function createShadowHost(): {
  container: HTMLDivElement;
  reactHost: HTMLDivElement;
} {
  const container = document.createElement('div');
  const shadow = container.attachShadow({ mode: SHADOW_MODE });

  const bridged = shadowCss.replace(/:root\s*\{/g, ':host, :root {');
  const style = document.createElement('style');
  style.textContent = bridged;

  const reactHost = document.createElement('div');
  shadow.append(style, reactHost);

  return { container, reactHost };
}
