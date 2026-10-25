import { Heading, Text } from '@flyt/ui';
import { Check } from 'lucide-react';

const proofs = [
  'Ordbokene definitions',
  'FSRS scheduling',
  'Frequency-ranked vocabulary',
  'Full inflection tables',
] as const;

export function ProofStrip() {
  return (
    <div className="border-y border-default bg-raised">
      <div className="shell-px py-5">
        <div className="container-max mx-auto flex flex-wrap items-center gap-x-10 gap-y-3">
          <Heading as="div" id="proof-strip-label" size="xxsmall" tone="subtle">
            Built on
          </Heading>
          <ul
            aria-labelledby="proof-strip-label"
            className="flex flex-wrap items-center gap-x-10 gap-y-3"
            role="list"
          >
            {proofs.map((proof) => (
              <li className="flex items-center gap-2" key={proof}>
                <Check className="shrink-0 text-icon-brand" />
                <Text as="span" size="medium" weight="semibold" tone="default">
                  {proof}
                </Text>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

ProofStrip.displayName = 'ProofStrip';
