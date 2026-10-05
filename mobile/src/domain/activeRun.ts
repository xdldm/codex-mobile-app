import type { BridgeRunSummary } from "./bridge";

export type AttachableRun = {
  id: string;
  threadId: string;
};

export function isActiveRunStatus(status: string) {
  return status === "starting" || status === "running" || status === "waiting_approval";
}

/**
 * The run the chat should be streaming right now: the active run of the
 * selected thread, if any.
 *
 * Kept pure so the reattach effect can key on a stable run id. Refreshing
 * `activeRuns` produces a new array on every poll, and re-running the effect
 * then would abort and restart a healthy stream.
 */
export function pickAttachableRun(
  runs: BridgeRunSummary[],
  threadId: string | null | undefined
): AttachableRun | null {
  if (!threadId) {
    return null;
  }

  const found = runs.find((run) => run.thread_id === threadId && isActiveRunStatus(run.status));
  return found ? { id: found.run_id, threadId: found.thread_id } : null;
}
