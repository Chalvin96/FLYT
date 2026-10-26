import type { MsgResult } from "../lib/messages";
import { API_PERMISSION_MESSAGE } from "../lib/permissions";

export type PopupFailure = Extract<MsgResult, { ok: false }>;

export function buildPopupError(failure: PopupFailure) {
  switch (failure.error) {
    case "network":
      return {
        message: failure.message ?? "Can't reach Flyt. Check your connection.",
        retry: true,
        openFlyt: false,
      };
    case "quota-reached":
      return {
        message: failure.message ?? "You've reached today's limit.",
        retry: false,
        openFlyt: true,
      };
    case "permission":
      return { message: API_PERMISSION_MESSAGE, retry: false, openFlyt: false };
    case "unauthorized":
      return {
        message: "Sign in to translate selected text.",
        retry: false,
        openFlyt: false,
      };
    case "too-large":
    case "invalid-page":
      return {
        message: failure.message ?? "Something went wrong on Flyt's side.",
        retry: false,
        openFlyt: true,
      };
    case "unknown":
      return {
        message: failure.message ?? "Something went wrong on Flyt's side.",
        retry: true,
        openFlyt: true,
      };
  }
}
