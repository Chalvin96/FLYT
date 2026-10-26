export type HeroChip = {
  label: string;
  icon?: React.ReactNode;
};

export type HeroTone = 'brand' | 'calm' | 'deep' | 'quiet';

export type HeroProgress = {
  current: number;
  total: number;
  showBar: boolean;
  showPercentage: boolean;
};

export interface BaseHeroCardProps {
  tone?: HeroTone;
  label: string;
  badge?: string;
  title: string;
  subtitle?: string;
  decoration?: React.ReactNode;
  details?: React.ReactNode;
  primaryAction: React.ReactNode;
  secondaryAction?: React.ReactNode;
  chip?: HeroChip;
  progress?: HeroProgress;
}
