import { useEffect, useRef, useState } from "react";
import { LemmaCardView, type LemmaAction, type LemmaActionState } from "@flyt/lexicon";
import { Button } from "@flyt/ui";

import { MSG_KIND, MSG_RESULT_KIND, sendMessage, type LemmaContext } from "../lib/messages";
import { toLemmaPos } from "../lib/resolve-types";
import type { LemmaDefinitionsResponse, ResolveCandidate, ResolveResponse } from "../lib/resolve-types";

import { toLemmaCardData } from './lemmaCardData';

type CandidateStatus = {
  state: LemmaActionState;
  pendingAction?: LemmaAction;
  error?: "unauthorized" | "retry";
  failedAction?: LemmaAction;
};

function stateFromCandidate(
  candidate: ResolveCandidate,
  detail?: LemmaDefinitionsResponse,
): LemmaActionState {
  const detailState = detail?.definitions[0]?.userState;
  if (detailState === "learning" || detailState === "mastered") {
    return detailState;
  }
  return candidate.state === "known" ? "mastered" : "new";
}

export function CandidateListView({
  items,
  onResolveWord,
  context,
}: {
  items: ResolveCandidate[];
  onResolveWord: (word: string) => void;
  context?: LemmaContext;
}) {
  const [details, setDetails] = useState<
    Record<
      string,
      { status: "loading" | "ready" | "error"; data?: LemmaDefinitionsResponse }
    >
  >({});
  const [statuses, setStatuses] = useState<Record<string, CandidateStatus>>({});
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const initial = Object.fromEntries(
      items.map((item) => [item.lemma_uuid, { status: "loading" as const }]),
    );
    setDetails(initial);
    for (const item of items) {
      void sendMessage({
        kind: MSG_KIND.DETAIL,
        lemma_uuid: item.lemma_uuid,
      })
        .then((result) => {
          if (requestId !== requestIdRef.current) return;
          if (result.ok && result.kind === MSG_RESULT_KIND.DETAIL) {
            setDetails((current) => ({
              ...current,
              [item.lemma_uuid]: { status: "ready", data: result.data },
            }));
          } else {
            setDetails((current) => ({
              ...current,
              [item.lemma_uuid]: { status: "error" },
            }));
          }
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setDetails((current) => ({
            ...current,
            [item.lemma_uuid]: { status: "error" },
          }));
        });
    }
    return () => {
      if (requestId === requestIdRef.current) requestIdRef.current += 1;
    };
  }, [items]);

  const getDetail = (uuid: string) => details[uuid];
  const getStatus = (candidate: ResolveCandidate): CandidateStatus => {
    const current = statuses[candidate.lemma_uuid];
    if (current) return current;
    return {
      state: stateFromCandidate(
        candidate,
        getDetail(candidate.lemma_uuid)?.data,
      ),
    };
  };

  const handleAction = async (
    candidate: ResolveCandidate,
    action: LemmaAction,
  ) => {
    const uuid = candidate.lemma_uuid;
    const state = getStatus(candidate).state;
    setStatuses((current) => ({
      ...current,
      [uuid]: { state, pendingAction: action },
    }));
    try {
      const result =
        action === "know"
          ? await sendMessage({ kind: MSG_KIND.KNOW, lemma_uuid: uuid })
          : await sendMessage({ kind: MSG_KIND.ADD, lemma_uuid: uuid, context });
      const success =
        (action === "know" &&
          result.ok &&
          result.kind === MSG_RESULT_KIND.KNOWN) ||
        (action === "add" &&
          result.ok &&
          result.kind === MSG_RESULT_KIND.ADDED);
      if (success) {
        setStatuses((current) => ({
          ...current,
          [uuid]: { state: action === "know" ? "mastered" : "learning" },
        }));
      } else {
        setStatuses((current) => ({
          ...current,
          [uuid]: {
            state,
            error:
              !result.ok && result.error === "unauthorized"
                ? "unauthorized"
                : "retry",
            failedAction: action,
          },
        }));
      }
    } catch {
      setStatuses((current) => ({
        ...current,
        [uuid]: { state, error: "retry", failedAction: action },
      }));
    }
  };

  const handleSignIn = async (uuid: string) => {
    await sendMessage({ kind: MSG_KIND.SIGN_IN });
    setStatuses((current) => ({
      ...current,
      [uuid]: { state: current[uuid]?.state ?? "new" },
    }));
  };

  const renderCandidate = (candidate: ResolveCandidate) => {
    const detailState = getDetail(candidate.lemma_uuid);
    const status = getStatus(candidate);
    const card = toLemmaCardData(candidate, detailState?.data);
    return (
      <div className="flyt-entry" key={candidate.lemma_uuid}>
        {detailState?.status === "loading" && (
          <p className="flyt-detail-status" role="status">
            Loading full entry...
          </p>
        )}
        <LemmaCardView
          lemma={card}
          state={status.state}
          pendingAction={status.pendingAction}
          behavior={{
            showStateLabels: true,
            disableKnowWhenLearning: false,
            disableAddWhenLearning: context === undefined,
            disableOtherActionWhilePending: true,
          }}
          headingClassName="flyt-headword"
          knowLabel="I already know this"
          addLabel="Add to review"
          onMarkKnown={() => handleAction(candidate, "know")}
          onAddToReview={() => handleAction(candidate, "add")}
          onSelectRelated={(_uuid, word) => onResolveWord(word)}
        />
        {status.error && (
          <div className="flyt-action-error" role="alert">
            <span>
              {status.error === "unauthorized"
                ? "Sign in to save this word."
                : "Could not save this word. Try again."}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                status.error === "unauthorized"
                  ? void handleSignIn(candidate.lemma_uuid)
                  : void handleAction(candidate, status.failedAction ?? "add")
              }
            >
              {status.error === "unauthorized" ? "Sign in to Flyt" : "Retry"}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const [first, ...rest] = items;
  return (
    <div className="flyt-results">
      {first && renderCandidate(first)}
      {rest.map((candidate) => (
        <details className="flyt-homograph" key={candidate.lemma_uuid}>
          <summary>
            <span>{candidate.word}</span>
            <span className="flyt-homograph-meta">
              {toLemmaPos(candidate.pos) ?? "entry"}
            </span>
          </summary>
          {renderCandidate(candidate)}
        </details>
      ))}
    </div>
  );
}

export function ResultView({
  res,
  onSearch,
  onResolveWord,
  context,
}: {
  res: ResolveResponse;
  onSearch: () => void;
  onResolveWord: (word: string) => void;
  context?: LemmaContext;
}) {
  if (res.candidates.length === 0) {
    return (
      <div className="flyt-empty">
        <p>No entry for &quot;{res.query}&quot;.</p>
        <Button
          size="sm"
          variant="ghost"
          onClick={onSearch}
          className="flyt-search-toggle"
        >
          Search
        </Button>
      </div>
    );
  }

  return (
    <div>
      <CandidateListView
        items={res.candidates}
        onResolveWord={onResolveWord}
        context={context}
      />
      <Button
        size="sm"
        variant="ghost"
        onClick={onSearch}
        className="flyt-search-toggle"
      >
        Search
      </Button>
    </div>
  );
}
