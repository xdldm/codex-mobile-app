import { describe, expect, it } from "vitest";

import type { BridgeThreadService } from "../src/appServer/types.js";
import { RunRegistry } from "../src/runs/RunRegistry.js";
import type { BridgeSseEvent } from "../src/sse.js";

const RUN_ID = "run_1";

describe("RunRegistry reconnect window", () => {
  it("replays only the events the client has not rendered yet", async () => {
    const registry = new RunRegistry(fakeThreadService(turnWithDeltas(3)), {
      maxBufferedEvents: 100
    });
    const run = await registry.startRun("thr_1", { message: "hi" });
    await waitForCompletion(registry, run.run_id);

    // run_started(1), delta(2..4), done(5); the client already rendered seq 1.
    expect(seqs(await collect(registry.subscribe(run.run_id, 1).events))).toEqual([2, 3, 4, 5]);
  });

  it("keeps the newest events when the buffer overflows", async () => {
    const registry = new RunRegistry(fakeThreadService(turnWithDeltas(3)), {
      maxBufferedEvents: 3
    });
    const run = await registry.startRun("thr_1", { message: "hi" });
    await waitForCompletion(registry, run.run_id);

    expect(seqs(await collect(registry.subscribe(run.run_id, 0).events))).toEqual([3, 4, 5]);
  });

  it("stops reporting a run that is still in flight as active", async () => {
    const registry = new RunRegistry(fakeThreadService(turnWithDeltas(1)));
    const run = await registry.startRun("thr_1", { message: "hi" });

    expect(registry.listActiveRuns().map((entry) => entry.run_id)).toContain(run.run_id);

    await waitForCompletion(registry, run.run_id);

    expect(registry.listActiveRuns()).toEqual([]);
    expect(registry.getRun(run.run_id).status).toBe("completed");
  });
});

describe("RunRegistry retention", () => {
  it("forgets a finished run once its replay window closes", async () => {
    const registry = new RunRegistry(fakeThreadService(turnWithDeltas(2)), {
      runRetentionMs: 30
    });
    const run = await registry.startRun("thr_1", { message: "hi" });
    await waitForCompletion(registry, run.run_id);

    // Still replayable right after it finishes, so a late reconnect can catch up.
    expect(() => registry.getRun(run.run_id)).not.toThrow();

    await waitFor(() => !hasRun(registry, run.run_id));

    expect(hasRun(registry, run.run_id)).toBe(false);
    expect(() => registry.subscribe(run.run_id, 0)).toThrow(/Run not found/);
  });
});

function hasRun(registry: RunRegistry, runId: string) {
  try {
    registry.getRun(runId);
    return true;
  } catch {
    return false;
  }
}

function turnWithDeltas(count: number): BridgeSseEvent[] {
  return [
    { event: "run_started", data: { thread_id: "thr_1", run_id: RUN_ID } },
    ...Array.from({ length: count }, (_, index) => ({
      event: "agent_message_delta",
      data: {
        thread_id: "thr_1",
        run_id: RUN_ID,
        item_id: "item_1",
        text: String(index + 1)
      }
    })),
    { event: "done", data: { thread_id: "thr_1", run_id: RUN_ID, status: "completed" } }
  ];
}

function fakeThreadService(events: BridgeSseEvent[]): BridgeThreadService {
  return {
    health: async () => ({
      runtime: "sdk",
      ready: true,
      auth: "ok",
      codexCliVersion: "fake",
      checks: { codex_cli: "ok", codex_auth: "ok" }
    }),
    listThreads: () => [],
    createThread: () => ({}),
    getThread: () => ({}),
    runThread: async function* runThread() {
      for (const event of events) {
        yield event;
      }
    },
    cancelRun: () => ({ cancelled: false }),
    listWorkspaces: () => []
  } as unknown as BridgeThreadService;
}

async function collect(events: AsyncIterable<BridgeSseEvent>) {
  const collected: BridgeSseEvent[] = [];
  for await (const event of events) {
    collected.push(event);
  }
  return collected;
}

function seqs(events: BridgeSseEvent[]) {
  return events.map((event) => (event.data as Record<string, unknown>).event_seq);
}

async function waitForCompletion(registry: RunRegistry, runId: string) {
  await waitFor(() => {
    try {
      return isTerminal(registry.getRun(runId).status);
    } catch {
      return false;
    }
  });
}

function isTerminal(status: string) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for condition");
}
