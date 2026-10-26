import { Table, Text } from '@flyt/ui';
import type { ReactNode } from 'react';

import {
  buildDesktopClassName,
  buildMobileClassName,
  dataCellCls,
  headerCellCls,
  panelCls,
  sectionLabelCls,
  type InflectionLayout,
} from './inflectionStyles';

export function InflectionSurface({
  layout,
  desktop,
  mobile,
}: {
  layout: InflectionLayout;
  desktop: ReactNode;
  mobile: ReactNode;
}) {
  return (
    <div className="w-full">
      <div className={buildDesktopClassName(layout)}>
        <div className={panelCls}>
          <Table variant="reference">{desktop}</Table>
        </div>
      </div>

      <div
        data-testid="inflection-mobile"
        className={buildMobileClassName(layout)}
      >
        {mobile}
      </div>
    </div>
  );
}

export function InflectionMobileRow({
  label,
  value,
  prefix,
  children,
}: {
  label: ReactNode;
  value?: ReactNode;
  prefix?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex">
      <div className={headerCellCls}>
        <Text as="span" role="eyebrow">
          {label}
        </Text>
      </div>
      {children ?? (
        <div className={dataCellCls}>
          {prefix ? (
            <Text as="span" size="small" tone="subtle">
              <span className="mr-1 italic">{prefix}</span>
            </Text>
          ) : null}
          <Text as="span" size="medium" tone="default" weight="semibold">
            {value}
          </Text>
        </div>
      )}
    </div>
  );
}

export function InflectionSectionLabel({
  children,
  border = 'bottom',
}: {
  children: ReactNode;
  border?: 'bottom' | 'y';
}) {
  const borderCls = border === 'y' ? 'border-y' : 'border-b';
  return (
    <div className={`${sectionLabelCls} ${borderCls} border-default`}>
      <Text as="div" role="eyebrow">
        {children}
      </Text>
    </div>
  );
}
