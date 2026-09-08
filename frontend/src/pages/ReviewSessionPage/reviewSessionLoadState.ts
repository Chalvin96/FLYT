/** Async state of the review queue backing the session, grouped as one view. */
export interface ReviewSessionLoadState {
  isLoading: boolean;
  isError: boolean;
  isRetrying: boolean;
}

export const IDLE_LOAD_STATE: ReviewSessionLoadState = {
  isLoading: false,
  isError: false,
  isRetrying: false,
};
