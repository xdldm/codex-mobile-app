import type { BridgeRunSummary } from "../src/domain/bridge";
import { isActiveRunStatus, pickAttachableRun } from "../src/domain/activeRun";

function run(overrides: Partial<BridgeRunSummary> & { run_id: string }): BridgeRunSummary {
  return {
    thread_id: "thr_1",
    status: "running",
    created_at: "2026-10-05T00:00:00.000Z",
    updated_at: "2026-10-05T00:00:00.000Z",
    last_event_seq: 1,
    ...overrides
  };
}

describe("isActiveRunStatus", () => {
  it("treats in-flight statuses as active", () => {
    expect(isActiveRunStatus("starting")).toBe(true);
    expect(isActiveRunStatus("running")).toBe(true);
    expect(isActiveRunStatus("waiting_approval")).toBe(true);
  });

  it("treats terminal statuses as inactive", () => {
    expect(isActiveRunStatus("completed")).toBe(false);
    expect(isActiveRunStatus("failed")).toBe(false);
    expect(isActiveRunStatus("cancelled")).toBe(false);
  });
});

describe("pickAttachableRun", () => {
  it("picks the active run of the selected thread", () => {
    expect(
      pickAttachableRun(
        [run({ run_id: "run_a", thread_id: "thr_1", status: "running" })],
        "thr_1"
      )
    ).toEqual({ id: "run_a", threadId: "thr_1" });
  });

  it("ignores runs from other threads", () => {
    expect(
      pickAttachableRun([run({ run_id: "run_a", thread_id: "thr_2" })], "thr_1")
    ).toBeNull();
  });

  it("ignores runs that already finished", () => {
    expect(
      pickAttachableRun(
        [
          run({ run_id: "run_done", status: "completed" }),
          run({ run_id: "run_live", status: "waiting_approval" })
        ],
        "thr_1"
      )
    ).toEqual({ id: "run_live", threadId: "thr_1" });
  });

  it("returns null without a selected thread", () => {
    expect(pickAttachableRun([run({ run_id: "run_a" })], null)).toBeNull();
    expect(pickAttachableRun([run({ run_id: "run_a" })], undefined)).toBeNull();
    expect(pickAttachableRun([run({ run_id: "run_a" })], "")).toBeNull();
  });
});
