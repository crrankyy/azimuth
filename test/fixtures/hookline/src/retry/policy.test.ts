import { expect, it } from "vitest";
import { createFakeBus, type FakeBus } from "../../test/support/fake-bus";
import { DEFAULT_POLICY, decideRetry } from "./policy";
import type { DeliveryState, RetryDecision } from "./types";

const now = new Date("2026-10-18T11:50:00Z");

interface Row {
  state: DeliveryState;
  attemptCount: number;
}

function memoryStore(rows: Record<string, Row>) {
  return {
    state: (id: string) => rows[id]?.state,
    apply(id: string, decision: RetryDecision, bus: FakeBus) {
      const row = rows[id];
      if (!row) return;
      row.attemptCount += 1;
      if (decision.kind === "retry") row.state = "scheduled_retry";
      if (decision.kind === "permanent") row.state = "failed_permanent";
      if (decision.kind === "exhausted") {
        row.state = "exhausted";
        bus.emit("delivery.exhausted", { deliveryId: id, attempts: decision.attempts });
      }
    },
  };
}

it("schedules a retry while attempts remain", () => {
  const decision = decideRetry(DEFAULT_POLICY, 3, { status: 500, headers: new Headers() }, now);
  expect(decision.kind).toBe("retry");
});

it("S-005.2.1 marks delivery exhausted after maxAttempts", () => {
  const bus = createFakeBus();
  const store = memoryStore({ d1: { state: "in_flight", attemptCount: 7 } });
  const decision = decideRetry(DEFAULT_POLICY, 7, { status: 500, headers: new Headers() }, now);
  store.apply("d1", decision, bus);

  expect(store.state("d1")).toBe("exhausted");
  expect(bus.emitted("delivery.exhausted")).toEqual([{ deliveryId: "d1", attempts: 8 }]);
});

it("allows eight attempts by default", () => {
  expect(DEFAULT_POLICY.maxAttempts).toBe(8);
});
