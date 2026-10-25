import { useEffect, useRef, useState } from "react";
import type { LemmaAction, LemmaActionState } from "@flyt/lexicon";

import {
  MSG_KIND,
  MSG_RESULT_KIND,
  sendMessage,
  type LemmaContext,
} from "../lib/messages";
import type {
  LemmaDefinitionsResponse,
  ResolveCandidate,
} from "../lib/resolve-types";
import type { PopupFailure } from "./buildPopupError";

type CandidateStatus =
  | { kind: "ready"; state: LemmaActionState }
  | { kind: "saving"; state: LemmaActionState; action: LemmaAction }
  | {
      kind: "error";
      state: LemmaActionState;
      action: LemmaAction;
      failure: PopupFailure;
    };

export function useLemmaCandidates(
  items: ResolveCandidate[],
  context?: LemmaContext,
) {
  const [details, setDetails] = useState<
    Record<string, LemmaDefinitionsResponse>
  >({});
  const [statuses, setStatuses] = useState<Record<string, CandidateStatus>>({});
  const [activeUuid, setActiveUuid] = useState(items[0]?.lemma_uuid);
  const generation = useRef(0);

  useEffect(() => {
    const request = ++generation.current;
    for (const candidate of items) {
      void sendMessage({
        kind: MSG_KIND.DETAIL,
        lemma_uuid: candidate.lemma_uuid,
      })
        .then((result) => {
          if (request !== generation.current) return;
          if (result.ok && result.kind === MSG_RESULT_KIND.DETAIL) {
            setDetails((current) => ({
              ...current,
              [candidate.lemma_uuid]: result.data,
            }));
          }
        })
        .catch(() => {});
    }
    return () => {
      generation.current += 1;
    };
  }, [items]);

  const getStatus = (candidate: ResolveCandidate): CandidateStatus => {
    const saved = statuses[candidate.lemma_uuid];
    if (saved) return saved;
    const detailState =
      details[candidate.lemma_uuid]?.definitions[0]?.userState;
    return {
      kind: "ready",
      state:
        detailState === "learning" || detailState === "mastered"
          ? detailState
          : candidate.state === "known"
            ? "mastered"
            : "new",
    };
  };

  const act = async (candidate: ResolveCandidate, action: LemmaAction) => {
    const uuid = candidate.lemma_uuid;
    const state = getStatus(candidate).state;
    setStatuses((current) => ({
      ...current,
      [uuid]: { kind: "saving", state, action },
    }));
    let failure: PopupFailure;
    try {
      const result =
        action === "know"
          ? await sendMessage({ kind: MSG_KIND.KNOW, lemma_uuid: uuid })
          : await sendMessage({
              kind: MSG_KIND.ADD,
              lemma_uuid: uuid,
              context,
            });
      if (
        result.ok &&
        ((action === "know" && result.kind === MSG_RESULT_KIND.KNOWN) ||
          (action === "add" && result.kind === MSG_RESULT_KIND.ADDED))
      ) {
        setStatuses((current) => ({
          ...current,
          [uuid]: {
            kind: "ready",
            state: action === "know" ? "mastered" : "learning",
          },
        }));
        return;
      }
      failure = result.ok ? { ok: false, error: "unknown" } : result;
    } catch {
      failure = { ok: false, error: "network" };
    }
    setStatuses((current) => ({
      ...current,
      [uuid]: { kind: "error", state, action, failure },
    }));
  };

  return {
    details,
    getStatus,
    act,
    active:
      items.find((candidate) => candidate.lemma_uuid === activeUuid) ??
      items[0],
    setActiveUuid,
  };
}
