export type InflectionLayout = 'auto' | 'horizontal' | 'vertical';

const labelSurfaceCls = 'bg-secondary-10 text-secondary-80';

export const panelCls =
  'radius-field overflow-hidden border border-border bg-card';

export const thCls = `border border-border px-3 py-2 text-center type-label-xs ${labelSurfaceCls}`;
export const tdCls =
  'border border-border px-3 py-2 text-left type-caption font-semibold text-foreground';
export const tdMutedCls = 'type-caption-sm italic text-muted-foreground';

export const headerCellCls = `type-label-xs flex w-32 shrink-0 items-center px-3 py-2.5 ${labelSurfaceCls}`;
export const dataCellCls =
  'flex min-w-0 flex-1 items-center px-3 py-2.5 type-caption font-medium text-foreground';
export const sectionLabelCls = `type-label-xs px-3 py-1.5 text-left ${labelSurfaceCls}`;
export const dividerCls = 'divide-y divide-border';

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
