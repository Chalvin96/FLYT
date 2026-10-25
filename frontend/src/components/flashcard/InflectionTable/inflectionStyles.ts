export type InflectionLayout = 'auto' | 'horizontal' | 'vertical';

const labelSurfaceCls = 'bg-neutral-subtle text-subtle';

export const panelCls =
  'radius-field overflow-hidden border border-default bg-raised';

export const headerCellCls = `flex w-32 shrink-0 items-center px-3 py-2.5 ${labelSurfaceCls}`;
export const dataCellCls = 'flex min-w-0 flex-1 items-center px-3 py-2.5';
export const sectionLabelCls = `px-3 py-1.5 text-left ${labelSurfaceCls}`;
export const dividerCls = 'divide-y divide-[var(--border-default)]';

export function buildDesktopClassName(layout: InflectionLayout): string {
  if (layout === 'auto') return 'hidden lg:block';
  if (layout === 'horizontal') return 'block';
  return 'hidden';
}

export function buildMobileClassName(layout: InflectionLayout): string {
  if (layout === 'horizontal') return 'hidden';
  if (layout === 'auto') return `block lg:hidden ${panelCls}`;
  return panelCls;
}
