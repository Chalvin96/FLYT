import { ChoiceTile, Heading, Text } from '@flyt/ui';
import type { ReactNode } from 'react';

export function SessionLengthTile({
  title,
  cardsLabel,
  durationLabel,
  isDisabled,
  isSelected,
  tabStop,
  icon,
  onClick,
  hint,
}: {
  title: string;
  cardsLabel: string;
  durationLabel: string;
  isDisabled: boolean;
  isSelected: boolean;
  tabStop: boolean;
  icon: ReactNode;
  onClick: () => void;
  hint?: string;
}) {
  return (
    <ChoiceTile
      disabled={isDisabled}
      onClick={onClick}
      selected={isSelected}
      tabIndex={tabStop ? 0 : -1}
    >
      {icon}
      <Heading as="div" size="medium" tone="default">
        {title}
      </Heading>
      <Text
        size="medium"
        tone={isSelected && !isDisabled ? 'default' : 'subtle'}
      >
        {cardsLabel}
      </Text>
      <Text
        size="medium"
        tone={isSelected && !isDisabled ? 'default' : 'subtle'}
      >
        {durationLabel}
      </Text>
      {hint ? (
        <div className="text-warning">
          <Text as="p" size="medium" weight="semibold">
            {hint}
          </Text>
        </div>
      ) : null}
    </ChoiceTile>
  );
}
