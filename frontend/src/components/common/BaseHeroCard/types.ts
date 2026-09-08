export type HeroChip = {
  label: string;
  className?: string;
  icon?: React.ReactNode;
};

export type HeroProgress = {
  current: number;
  total: number;
  showBar: boolean;
  showPercentage: boolean;
};

export interface BaseHeroCardProps {
  className: string;
  label: string;
  labelClass: string;
  badge: string;
  badgeClass: string;
  title: string;
  subtitle: string;
  subtitleClass: string;
  decoration?: React.ReactNode;
  details?: React.ReactNode;
  primaryAction: React.ReactNode;
  secondaryAction?: React.ReactNode;
  chip?: HeroChip;
  progress?: HeroProgress;
}
