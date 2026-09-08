import type { DefinitionRead, LemmaPos } from './types';
import { DefinitionView } from './DefinitionView';

// A single resolve candidate projected to the view model the list consumes.
// The frontend and the extension each adapt their own payload to this shape.
export interface CandidateListItem {
  lemmaUuid: string;
  word: string;
  definition: DefinitionRead;
  pos?: LemmaPos;
}

export interface CandidateListProps {
  candidates: CandidateListItem[];
  onAdd?: (lemmaUuid: string) => void;
  addingUuid?: string | null;
  addedUuids?: Set<string>;
}

export function CandidateList({
  candidates,
  onAdd,
  addingUuid,
  addedUuids,
}: CandidateListProps) {
  if (candidates.length === 0) return null;

  const [first, ...rest] = candidates;
  const isAdding = (uuid: string) => addingUuid === uuid;
  const isAdded = (uuid: string) => !!addedUuids && addedUuids.has(uuid);

  const renderCandidate = (item: CandidateListItem) => (
    <DefinitionView
      key={item.lemmaUuid}
      definition={item.definition}
      pos={item.pos}
      isAdding={isAdding(item.lemmaUuid)}
      isAdded={isAdded(item.lemmaUuid)}
      onAddToDeck={
        onAdd
          ? () => {
              onAdd(item.lemmaUuid);
            }
          : undefined
      }
    />
  );

  return (
    <div>
      {first && renderCandidate(first)}
      {rest.length > 0 && (
        <details>
          <summary>other meanings ({rest.length})</summary>
          <div className="mt-2 space-y-2">
            {rest.map((item) => renderCandidate(item))}
          </div>
        </details>
      )}
    </div>
  );
}
