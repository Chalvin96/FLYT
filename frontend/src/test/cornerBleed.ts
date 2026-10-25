export type Corner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

export type CornerBleed = {
  container: Element;
  child: Element;
  corner: Corner;
  description: string;
};

const CORNERS: Corner[] = [
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left',
];

export function finishAnimations(root: Element): void {
  const animationRoots: (Element | ShadowRoot)[] = [root];
  for (const element of collectElements(root)) {
    if (element.shadowRoot) animationRoots.push(element.shadowRoot);
  }

  for (const animationRoot of animationRoots) {
    for (const animation of animationRoot.getAnimations({ subtree: true })) {
      if (animation.effect?.getComputedTiming().endTime === Infinity) {
        animation.effect.updateTiming({ iterations: 1 });
      }
      animation.finish();
    }
  }
}

export function collectCornerBleeds(root: Element): CornerBleed[] {
  const elements = collectElements(root);
  const bleeds: CornerBleed[] = [];

  for (const container of elements) {
    const containerStyle = getComputedStyle(container);
    const containerRect = container.getBoundingClientRect();
    if (
      !hasVisibleBox(containerStyle, containerRect) ||
      Number(containerStyle.opacity) === 0
    ) {
      continue;
    }

    for (const corner of CORNERS) {
      const radius = getCornerRadius(containerStyle, containerRect, corner);
      if (radius <= 0) continue;

      const borderWidth = getCornerBorderWidth(containerStyle, corner);
      const point = buildCornerProbe(
        containerRect,
        corner,
        radius,
        borderWidth,
      );
      if (!point) continue;

      for (const child of collectElements(container).slice(1)) {
        const childStyle = getComputedStyle(child);
        const childRect = child.getBoundingClientRect();
        if (
          !hasVisibleBox(childStyle, childRect) ||
          !hasNonzeroOpacityThrough(child, container) ||
          !isPaintedAtCorner(childStyle, childRect, point, corner)
        ) {
          continue;
        }
        if (!isPointInsideRect(childRect, point)) continue;
        if (hasProtectiveClip(container, child, point, corner, radius))
          continue;
        if (hasProtectiveClipBetween(child, container, point, corner, radius))
          continue;

        const childRadius = getCornerRadius(childStyle, childRect, corner);
        if (childRadius >= radius - borderWidth - 1) continue;

        bleeds.push({
          container,
          child,
          corner,
          description: `${getElementDescription(container)}: ${getElementDescription(child)} bleeds at ${corner}`,
        });
      }
    }
  }

  return bleeds;
}

function collectElements(root: Element): Element[] {
  const elements = [root];
  for (const child of root.children) {
    elements.push(...collectElements(child));
  }
  for (const child of root.shadowRoot?.children ?? []) {
    elements.push(...collectElements(child));
  }
  return elements;
}

function hasVisibleBox(style: CSSStyleDeclaration, rect: DOMRect): boolean {
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.visibility !== 'collapse' &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function hasOverflowClip(style: CSSStyleDeclaration): boolean {
  return (
    style.overflowX !== 'visible' ||
    style.overflowY !== 'visible' ||
    style.contain.split(' ').includes('paint')
  );
}

function hasNonzeroOpacityThrough(child: Element, container: Element): boolean {
  for (
    let ancestor: Element | null = child;
    ancestor;
    ancestor = getParentElementAcrossShadow(ancestor)
  ) {
    if (Number(getComputedStyle(ancestor).opacity) === 0) return false;
    if (ancestor === container) return true;
  }
  return false;
}

function isPaintedAtCorner(
  style: CSSStyleDeclaration,
  rect: DOMRect,
  point: { x: number; y: number },
  corner: Corner,
): boolean {
  if (
    hasVisibleColor(style.backgroundColor) ||
    style.backgroundImage !== 'none'
  ) {
    return true;
  }

  const sides = {
    'top-left': ['Top', 'Left'],
    'top-right': ['Top', 'Right'],
    'bottom-right': ['Bottom', 'Right'],
    'bottom-left': ['Bottom', 'Left'],
  }[corner] as ('Top' | 'Right' | 'Bottom' | 'Left')[];
  return sides.some((side) => {
    const borderStyle = style[`border${side}Style`];
    const borderWidth = parseFloat(style[`border${side}Width`]);
    const borderColor = style[`border${side}Color`];
    return (
      borderStyle !== 'none' &&
      borderStyle !== 'hidden' &&
      borderWidth > 0 &&
      hasVisibleColor(borderColor) &&
      {
        Top: point.y <= rect.top + borderWidth,
        Right: point.x >= rect.right - borderWidth,
        Bottom: point.y >= rect.bottom - borderWidth,
        Left: point.x <= rect.left + borderWidth,
      }[side]
    );
  });
}

function hasVisibleColor(color: string): boolean {
  if (color === 'transparent') return false;
  if (color.startsWith('rgba(')) {
    return parseFloat(color.slice(color.lastIndexOf(',') + 1)) > 0;
  }
  return !/\/\s*0(?:\.0+)?%?\s*\)$/.test(color);
}

function getCornerRadius(
  style: CSSStyleDeclaration,
  rect: DOMRect,
  corner: Corner,
): number {
  const value = {
    'top-left': style.borderTopLeftRadius,
    'top-right': style.borderTopRightRadius,
    'bottom-right': style.borderBottomRightRadius,
    'bottom-left': style.borderBottomLeftRadius,
  }[corner];
  const [horizontal, vertical = horizontal] = value.split(' ');
  return Math.min(
    getResolvedLength(horizontal, rect.width),
    getResolvedLength(vertical, rect.height),
  );
}

function getResolvedLength(value: string, dimension: number): number {
  const number = parseFloat(value);
  return value.endsWith('%') ? (number / 100) * dimension : number;
}

function getCornerBorderWidth(
  style: CSSStyleDeclaration,
  corner: Corner,
): number {
  const widths = {
    'top-left': [style.borderTopWidth, style.borderLeftWidth],
    'top-right': [style.borderTopWidth, style.borderRightWidth],
    'bottom-right': [style.borderBottomWidth, style.borderRightWidth],
    'bottom-left': [style.borderBottomWidth, style.borderLeftWidth],
  }[corner];
  return Math.max(...widths.map(parseFloat));
}

function buildCornerProbe(
  rect: DOMRect,
  corner: Corner,
  radius: number,
  borderWidth: number,
): { x: number; y: number } | null {
  const inset = Math.max(radius * 0.15, borderWidth + 0.25);
  if (inset >= radius * (1 - Math.SQRT1_2)) return null;

  const point = {
    x: corner.endsWith('left') ? rect.left + inset : rect.right - inset,
    y: corner.startsWith('top') ? rect.top + inset : rect.bottom - inset,
  };
  if (
    point.x > rect.left + borderWidth &&
    point.x < rect.right - borderWidth &&
    point.y > rect.top + borderWidth &&
    point.y < rect.bottom - borderWidth
  ) {
    return point;
  }
  return null;
}

function isPointInsideRect(
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
  point: { x: number; y: number },
): boolean {
  return (
    rect.left <= point.x &&
    point.x <= rect.right &&
    rect.top <= point.y &&
    point.y <= rect.bottom
  );
}

function hasProtectiveClip(
  element: Element,
  child: Element,
  point: { x: number; y: number },
  corner: Corner,
  radius: number,
): boolean {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  if (
    hasOverflowClip(style) &&
    getCornerRadius(style, rect, corner) >= radius &&
    isPointOutsideRoundedCorner(
      rect,
      point,
      corner,
      getCornerRadius(style, rect, corner),
    )
  ) {
    return true;
  }
  if (style.clipPath === 'none') return false;

  const roundedInset = parseRoundedInset(style.clipPath, rect);
  if (roundedInset) {
    return (
      !isPointInsideRect(roundedInset.rect, point) ||
      (roundedInset.radius >= radius &&
        isPointOutsideRoundedCorner(
          roundedInset.rect,
          point,
          corner,
          roundedInset.radius,
        ))
    );
  }

  return (
    style.pointerEvents !== 'none' &&
    getComputedStyle(child).pointerEvents !== 'none' &&
    point.x >= 0 &&
    point.y >= 0 &&
    point.x < document.documentElement.clientWidth &&
    point.y < document.documentElement.clientHeight &&
    !document.elementsFromPoint(point.x, point.y).includes(child)
  );
}

function parseRoundedInset(
  clipPath: string,
  rect: DOMRect,
): {
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>;
  radius: number;
} | null {
  const match = /^inset\((.+) round ([\d.]+(?:px|%)?)\)$/.exec(clipPath);
  if (!match) return null;
  const offsets = match[1].trim().split(/\s+/);
  if (
    offsets.length > 4 ||
    offsets.some((offset) => !/^[\d.]+(?:px|%)?$/.test(offset))
  ) {
    return null;
  }
  const [top, right = top, bottom = top, left = right] = offsets;
  return {
    rect: {
      top: rect.top + getResolvedLength(top, rect.height),
      right: rect.right - getResolvedLength(right, rect.width),
      bottom: rect.bottom - getResolvedLength(bottom, rect.height),
      left: rect.left + getResolvedLength(left, rect.width),
    },
    radius: getResolvedLength(match[2], Math.min(rect.width, rect.height)),
  };
}

function isPointOutsideRoundedCorner(
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
  point: { x: number; y: number },
  corner: Corner,
  radius: number,
): boolean {
  if (!isPointInsideRect(rect, point)) return true;
  if (radius <= 0) return false;
  const centerX = corner.endsWith('left')
    ? rect.left + radius
    : rect.right - radius;
  const centerY = corner.startsWith('top')
    ? rect.top + radius
    : rect.bottom - radius;
  return (
    ((point.x - centerX) / radius) ** 2 + ((point.y - centerY) / radius) ** 2 >
    1
  );
}

function hasProtectiveClipBetween(
  child: Element,
  container: Element,
  point: { x: number; y: number },
  corner: Corner,
  radius: number,
): boolean {
  for (
    let ancestor = getParentElementAcrossShadow(child);
    ancestor && ancestor !== container;
    ancestor = getParentElementAcrossShadow(ancestor)
  ) {
    if (hasProtectiveClip(ancestor, child, point, corner, radius)) return true;
  }
  return false;
}

function getParentElementAcrossShadow(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

function getElementDescription(element: Element): string {
  const classes = [...element.classList]
    .slice(0, 2)
    .map((name) => `.${name}`)
    .join('');
  const text = element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 32);
  return `<${element.tagName.toLowerCase()}${classes}>${text ? ` "${text}"` : ''}`;
}
