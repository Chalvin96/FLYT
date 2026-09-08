import { Check } from 'lucide-react';

const proofs = [
  'Ordbokene definitions',
  'FSRS scheduling',
  'Frequency-ranked vocabulary',
  'Full inflection tables',
] as const;

export function ProofStrip() {
  return (
    <div className="border-y border-border bg-card">
      <div className="shell-px py-5">
        <div className="container-max mx-auto flex flex-wrap items-center gap-x-10 gap-y-3">
          <p
            className="type-label-sm text-muted-foreground"
            id="proof-strip-label"
          >
            Built on
          </p>
          <ul
            aria-labelledby="proof-strip-label"
            className="flex flex-wrap items-center gap-x-10 gap-y-3"
            role="list"
          >
            {proofs.map((proof) => (
              <li
                className="flex items-center gap-2 type-caption font-semibold text-foreground"
                key={proof}
              >
                <Check className="shrink-0 text-primary-70" />
                {proof}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

ProofStrip.displayName = 'ProofStrip';
