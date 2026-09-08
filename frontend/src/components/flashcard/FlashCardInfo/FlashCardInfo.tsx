import { Button } from '@/components/common/Button/Button';
import { FlashCardFrame } from '@/components/flashcard/FlashCardFrame';
import { BlockView } from '@/components/portable/BlockView';
import { groupSectionEntries } from '@/components/portable/dialogueGrouping';
import { DialogueView } from '@/components/portable/DialogueView';
import { ExampleGroupView } from '@/components/portable/ExampleGroupView';
import type { AudioAsset, SectionPacket } from '@/types/lesson-contracts';

type FlashCardInfoProps = {
  section: SectionPacket;
  audioById?: Record<string, AudioAsset>;
  className?: string;
  desktopExpanded?: boolean;
  isSubmitting?: boolean;
  onContinue?: () => void;
};

const EMPTY_AUDIO_BY_ID: Record<string, AudioAsset> = {};

export function FlashCardInfo({
  section,
  audioById = EMPTY_AUDIO_BY_ID,
  className,
  desktopExpanded,
  isSubmitting,
  onContinue,
}: FlashCardInfoProps) {
  return (
    <FlashCardFrame
      className={className}
      desktopExpanded={desktopExpanded}
      eyebrow={section.role}
      title={section.title}
      footer={
        onContinue ? (
          <Button
            className="w-full"
            disabled={isSubmitting}
            onClick={onContinue}
          >
            Continue
          </Button>
        ) : null
      }
    >
      <div className="space-y-4">
        {groupSectionEntries(section.blocks).map((entry) =>
          entry.kind === 'dialogue' ? (
            <DialogueView
              key={entry.group.turns[0]?.id ?? entry.group.dialogueId}
              audioById={audioById}
              group={entry.group}
            />
          ) : entry.kind === 'example_group' ? (
            <ExampleGroupView
              key={entry.blocks[0]?.id ?? 'example-group'}
              blocks={entry.blocks}
              audioById={audioById}
            />
          ) : (
            <BlockView
              key={entry.block.id}
              block={entry.block}
              audioById={audioById}
            />
          ),
        )}
      </div>
    </FlashCardFrame>
  );
}
