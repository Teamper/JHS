import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JhsEventBus } from "../src/core/event-bus.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { StateService } from "../src/core/state-service.js";
import { StorageService } from "../src/services/storage-service.js";
import { mountMovieRemark } from "../src/ui/detail/movie-remark.js";

const cleanups = [];
afterEach(() => {
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
    vi.restoreAllMocks();
});

async function mountRemark(carNum, metadata = {}) {
    const dom = new JSDOM("<main></main>"), document = dom.window.document;
    const scope = new LifecycleScope("remark-test"), events = new JhsEventBus("remark-" + carNum);
    const values = new Map(), storage = new StorageService({
        get: async key => structuredClone(values.get(key)),
        set: async (key, value) => values.set(key, structuredClone(value)),
        remove: async key => values.delete(key),
    });
    const state = new StateService(storage, events);
    const saved = { carNum, names: "已保存演员", publishTime: "2026-10-18", url: "https://javdb.com/v/original", title: "已保存标题" };
    await state.patch(carNum, { favorite: true }, { record: { ...saved, remark: "旧备注" } });
    let activeDialog, input;
    const dialog = {
        open(options) {
            const root = document.createElement("div");
            root.innerHTML = options.content;
            input = root.querySelector("textarea");
            activeDialog = options;
            options.success([root]);
            return 1;
        },
        close() { const options = activeDialog; activeDialog = null; options.end(); },
    };
    cleanups.push(() => dom.window.close(), () => events.channel.close(), () => scope.dispose());
    const report = vi.fn();
    mountMovieRemark({
        host: document.querySelector("main"), scope, state, events, dialog, report,
        getRecord: () => ({ carNum, ...metadata }),
    });
    const hint = document.querySelector(".jhs-badge");
    const button = document.querySelector('[role="menuitem"]');
    await vi.waitFor(() => expect(hint.textContent).toBe("旧备注"));
    return { scope, events, state, storage, saved, hint, report, async edit(value) {
        button.click();
        await vi.waitFor(() => expect(activeDialog).toBeTruthy());
        input.value = value;
        await activeDialog.yes(1);
    } };
}

describe("movie remark", () => {
    it.each(["ABC-123", "FC2-1234567"])("edits and clears %s with incomplete detail metadata", async carNum => {
        const { state, saved, hint, edit, report } = await mountRemark(carNum, { names: "", publishTime: "", url: "", title: "  " });
        await edit("新备注");
        expect(await state.getState(carNum)).toMatchObject({ ...saved, remark: "新备注" });
        await vi.waitFor(() => expect(hint.textContent).toBe("新备注"));

        await edit("");
        expect(await state.getState(carNum)).toMatchObject({ ...saved, remark: "", stateFlags: { favorite: true } });
        await vi.waitFor(() => expect(hint.hidden).toBe(true));
        expect(hint.textContent).toBe("");
        expect(report).not.toHaveBeenCalled();
    });

    it("refreshes on matching edits and restore events and ignores a read completed after disposal", async () => {
        const { state, storage, events, scope, hint, report, saved } = await mountRemark("FC2-1234567");
        await state.patch(saved.carNum, {}, { type: "history-edit", record: { remark: "历史编辑" } });
        await vi.waitFor(() => expect(hint.textContent).toBe("历史编辑"));

        const current = await state.getState(saved.carNum);
        await storage.set("car_list", [{ ...current, remark: "恢复的备注" }]);
        await events.emit("car-state-changed", { carNums: ["ABC-999"] });
        expect(hint.textContent).toBe("历史编辑");
        await events.emit("car-state-changed", { scope: "all" });
        await vi.waitFor(() => expect(hint.textContent).toBe("恢复的备注"));

        const delayed = Promise.withResolvers();
        const read = vi.spyOn(state, "getState").mockReturnValueOnce(delayed.promise);
        const refresh = events.emit("car-state-changed", { carNums: [saved.carNum] });
        expect(read).toHaveBeenCalledOnce();
        await refresh;
        scope.dispose();
        delayed.resolve({ remark: "关闭后返回的备注" });
        await delayed.promise;
        expect(hint.textContent).toBe("恢复的备注");
        await events.emit("car-state-changed", { scope: "all" });
        expect(read).toHaveBeenCalledOnce();
        expect(report).not.toHaveBeenCalled();
    });
});
