import { afterEach, describe, expect, it, vi } from "vitest";
import { NewVideoBatchController } from "../src/features/discovery/new-video-batch-controller.js";

describe("new-video batch controller", () => {
    afterEach(() => vi.useRealTimers());

    it("writes normalized flags and preserves legacy activity metadata", async () => {
        const state = { patch: vi.fn(async () => ({ changed: ["ABC-001"] })) };
        const controller = new NewVideoBatchController({ state });
        const result = await controller.run("favorite", [
            { carNum: "abc_001", url: "https://javdb.com/v/abc-001", actressName: "Alice", publishTime: "2026-08-01" },
            { carNum: "ABC-001", url: "/duplicate" },
            { carNum: "", actressName: "Invalid" },
        ]);

        expect(state.patch).toHaveBeenCalledWith(["ABC-001"], { favorite: true }, {
            type: "new-video-batch-state",
            records: [{ carNum: "ABC-001", url: "https://javdb.com/v/abc-001", names: "Alice", publishTime: "2026-08-01" }],
        });
        expect(result.changed).toEqual(["ABC-001"]);
    });

    it.each([
        ["ignore", "setNewVideoDecision", ["ABC-001"], "ignored"],
        ["restore", "setNewVideoDecision", ["ABC-001"], null],
        ["remove", "removeFromNewVideoList", ["ABC-001"], "manual"],
    ])("routes %s through its StateService operation", async (action, method, carNums, value) => {
        const state = { [method]: vi.fn(async () => ({ changed: carNums })) };
        const controller = new NewVideoBatchController({ state });
        await controller.run(action, [{ carNum: "abc_001" }]);
        expect(state[method]).toHaveBeenCalledWith(carNums, value);
    });

    it("uses the existing seven-day snooze decision and ignores empty batches", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-01T00:00:00.000Z"));
        const state = { setNewVideoDecision: vi.fn(async () => ({ changed: ["ABC-001"] })) };
        const controller = new NewVideoBatchController({ state });

        await controller.run("snooze", [{ carNum: "abc_001" }]);
        expect(state.setNewVideoDecision).toHaveBeenCalledWith(["ABC-001"], "snoozed", "2026-09-08T00:00:00.000Z");
        expect(await controller.run("ignore", [])).toEqual({ changed: [] });
        expect(state.setNewVideoDecision).toHaveBeenCalledOnce();
    });

    it("rejects unknown operations and refuses work after disposal", async () => {
        const controller = new NewVideoBatchController({ state: {} });
        await expect(controller.run("unknown", [{ carNum: "ABC-001" }])).rejects.toThrow("不支持的新作品批量操作");
        controller.dispose();
        await expect(controller.run("ignore", [{ carNum: "ABC-001" }])).rejects.toMatchObject({ name: "AbortError" });
    });
});
