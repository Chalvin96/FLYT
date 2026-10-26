import { expect, waitFor, within } from "storybook/test";

export async function expectShadowSurface(
  canvasElement: HTMLElement,
): Promise<ShadowRoot> {
  const host = canvasElement.querySelector<HTMLElement>(
    '[data-testid="extension-shadow-host"]',
  );

  await expect(host).not.toBeNull();

  const shadowRoot = host?.shadowRoot;
  await expect(shadowRoot).toBeInstanceOf(ShadowRoot);

  if (!shadowRoot) {
    throw new Error("The extension story did not mount an open shadow root.");
  }

  const renderedSurface = shadowRoot.querySelector<HTMLElement>(
    '[role="dialog"], [role="status"], button',
  );
  await expect(renderedSurface).not.toBeNull();
  await expect(renderedSurface?.getRootNode()).toBeInstanceOf(ShadowRoot);
  await waitFor(() => expect(renderedSurface).toBeVisible());
  await Promise.all(
    renderedSurface?.getAnimations().map((animation) => animation.finished) ??
      [],
  );

  return shadowRoot;
}

export function withinShadowRoot(shadowRoot: ShadowRoot) {
  return within(shadowRoot as unknown as HTMLElement);
}

export function withShadowRootPlay(
  play?: (shadowRoot: ShadowRoot) => void | Promise<void>,
) {
  return async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const shadowRoot = await expectShadowSurface(canvasElement);
    await play?.(shadowRoot);
  };
}
