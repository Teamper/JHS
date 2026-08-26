import { describe, expect, it } from "vitest";
import { endBatchRun, isActiveBatchRun, isBatchRunActive, isBatchRunCancelled, requestCancelBatchRun, tryBeginBatchRun } from "../src/features/list/batch-coordinator.js";

describe("batch Single Flight coordinator", () => {
    it("accepts exactly one run at a time", () => {
        const first = tryBeginBatchRun();
        expect(first).not.toBeNull();
        expect(isBatchRunActive()).toBe(true);
        expect(tryBeginBatchRun()).toBeNull();
        expect(tryBeginBatchRun()).toBeNull();
        endBatchRun(first);
        expect(isBatchRunActive()).toBe(false);
    });

    it("allows a new run after the previous one ends", () => {
        const first = tryBeginBatchRun();
        endBatchRun(first);
        const second = tryBeginBatchRun();
        expect(second).not.toBeNull();
        expect(isActiveBatchRun(second)).toBe(true);
        endBatchRun(second);
    });

    it("a stale run can never clear a newer run", () => {
        const first = tryBeginBatchRun();
        endBatchRun(first);
        const second = tryBeginBatchRun();
        // 旧任务的 finally 再次结束自己的 run：不得影响新 run。
        endBatchRun(first);
        expect(isActiveBatchRun(second)).toBe(true);
        expect(isBatchRunActive()).toBe(true);
        endBatchRun(second);
        expect(isBatchRunActive()).toBe(false);
    });
});

describe("batch cancel single-flight", () => {
    it("requestCancel marks the run but does not release the active slot", () => {
        const run = tryBeginBatchRun();
        expect(run).not.toBeNull();
        requestCancelBatchRun(run);
        expect(isBatchRunCancelled(run)).toBe(true);
        expect(isBatchRunActive()).toBe(true);
        expect(tryBeginBatchRun()).toBeNull();
        // Only the real finally may release the slot.
        endBatchRun(run);
        expect(isBatchRunActive()).toBe(false);
    });

    it("a stale cancel request cannot mark a newer run", () => {
        const first = tryBeginBatchRun();
        endBatchRun(first);
        const second = tryBeginBatchRun();
        requestCancelBatchRun(first);
        expect(isBatchRunCancelled(second)).toBe(false);
        expect(isActiveBatchRun(second)).toBe(true);
        endBatchRun(second);
    });
});
