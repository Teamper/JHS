import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { endBatchRun, tryBeginBatchRun } from "../src/features/list/batch-coordinator.js";
import { ListBatchUi } from "../src/features/list/list-batch-ui.js";

let dom;
let ui;

function setup() {
    dom = new JSDOM('<button id="favoriteAllVideo"></button><button id="hasDownAllVideo"></button><button id="filterAllVideo"></button>', { url: "https://javdb.com/search?q=synthetic" });
    const dialog = { confirm: vi.fn(() => 7), close: vi.fn() };
    const notifications = { error: vi.fn(), debug: vi.fn() };
    const diagnostics = { recordError: vi.fn() };
    ui = new ListBatchUi({ document: dom.window.document, dialog, notifications, diagnostics });
    return { dialog, notifications, diagnostics, document: dom.window.document };
}

afterEach(() => {
    ui?.dispose();
    ui = null;
    dom?.window.close();
    dom = null;
    vi.useRealTimers();
});

describe("ListBatchUi", () => {
    it("resolves confirmation only on accept and treats dialog dismissal as cancel", async () => {
        const { dialog } = setup();
        let options;
        let accept;
        dialog.confirm.mockImplementation((_message, value, yes) => { options = value; accept = yes; return 7; });

        const accepted = ui.confirm("确认合成批处理?");
        expect(dialog.confirm).toHaveBeenCalledWith("确认合成批处理?", expect.objectContaining({ btn: [ "确定", "取消" ], shade: 0 }), expect.any(Function));
        accept(7);
        options.end();
        await expect(accepted).resolves.toBe(true);
        expect(dialog.close).toHaveBeenCalledWith(7);

        const cancelled = ui.confirm("取消合成批处理?");
        options.end();
        await expect(cancelled).resolves.toBe(false);
    });

    it("closes a pending confirmation when the Feature scope is disposed", async () => {
        const { dialog } = setup();
        let options;
        dialog.confirm.mockImplementation((_message, value) => { options = value; return 11; });
        const pending = ui.confirm("待处理");

        ui.dispose();

        await expect(pending).resolves.toBe(false);
        expect(dialog.close).toHaveBeenCalledWith(11);
        options.end();
    });

    it("owns cancel and progress UI, writes progress as text, and removes timers on completion", async () => {
        vi.useFakeTimers();
        const { document } = setup();
        const run = tryBeginBatchRun();
        const progress = ui.beginProgress(run);
        const cancel = progress.querySelector("#jhs-batch-cancel");
        const label = progress.querySelector(".jhs-batch-progress__label");

        ui.setButtonsDisabled(true);
        expect(document.querySelectorAll(".jhs-batch-busy")).toHaveLength(3);
        cancel.click();
        expect(run.cancelRequested).toBe(true);
        ui.setProgress(progress, "<img src=x onerror=alert(1)>");
        expect(label.textContent).toBe("<img src=x onerror=alert(1)>");
        expect(label.querySelector("img")).toBeNull();

        ui.markWriting(progress);
        expect(cancel.disabled).toBe(true);
        cancel.click();
        expect(run.cancelRequested).toBe(true);
        ui.completeProgress(progress);
        await vi.advanceTimersByTimeAsync(1800);

        expect(document.querySelector("#jhs-batch-progress")).toBeNull();
        ui.setButtonsDisabled(false);
        expect(document.querySelectorAll(".jhs-batch-busy")).toHaveLength(0);
        endBatchRun(run);
    });

    it("disposal clears progress and restores batch buttons", () => {
        const { document } = setup();
        ui.beginProgress({ id: Symbol("batch"), cancelRequested: false });
        ui.setButtonsDisabled(true);

        ui.dispose();

        expect(document.querySelector("#jhs-batch-progress")).toBeNull();
        expect(document.querySelectorAll(".jhs-batch-busy")).toHaveLength(0);
    });
});
