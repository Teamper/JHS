import jquery from "jquery";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createListEvaluationContext } from "../src/features/list/list-evaluator.js";
import { ListBatchController } from "../src/features/list/list-batch-controller.js";
import { isBatchRunActive } from "../src/features/list/batch-coordinator.js";

let dom;
let controller;

function makeUi() {
    return {
        confirm: vi.fn(async () => true),
        beginProgress: vi.fn(() => ({})),
        setProgress: vi.fn(),
        markWriting: vi.fn(),
        completeProgress: vi.fn(),
        failProgress: vi.fn(),
        removeProgress: vi.fn(),
        setButtonsDisabled: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        reportError: vi.fn(),
    };
}

function setup(html = '<div class="item"><a href="/v/ABC-123"><div class="video-title"><strong>ABC-123</strong> Sample title</div></a><div class="meta">2026-01-01</div></div>') {
    dom = new JSDOM(html, { url: "https://javdb.com/search?q=synthetic" });
    const $ = jquery(dom.window);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("location", dom.window.location);
    vi.stubGlobal("DOMParser", dom.window.DOMParser);
    vi.stubGlobal("$", $);
    const ui = makeUi();
    const state = { patch: vi.fn(async () => {}) };
    const scope = { disposed: false };
    let activeFilter = "all";
    const createEvaluationContext = vi.fn(async () => createListEvaluationContext());
    const hostAdapter = {
        document: dom.window.document,
        location: dom.window.location,
        getPageContext: () => ({ kind: "search" }),
        getListSelectors: () => ({ requestDomItemSelector: ".item", nextPageSelector: ".pagination-next" }),
        resolveFirstPageUrl: (url) => url,
    };
    controller = new ListBatchController({ ui, getEvaluationContext: createEvaluationContext, getActiveFilter: () => activeFilter, hostAdapter, state, http: { request: vi.fn() }, scope });
    return { ui, state, scope, createEvaluationContext, setActiveFilter: (value) => { activeFilter = value; }, hostAdapter };
}

beforeEach(() => {});
afterEach(() => {
    controller?.dispose();
    controller = null;
    dom?.window.close();
    dom = null;
    vi.unstubAllGlobals();
});

describe("ListBatchController", () => {
    it("counts missing native numbers alongside prefix-only rows exactly once before writing", async () => {
        const { state, ui } = setup('<div class="item"><a href="/v/good"><div class="video-title"><strong>ABC-123</strong> Good</div></a></div><div class="item"><a href="/v/missing"><div class="video-title">Title without native number</div></a></div><div class="item"><a href="/v/prefix"><div class="video-title"><strong>FC2</strong> Prefix only</div></a></div>');
        expect(await controller.run({ kind: "search" }, "favorite", { confirm: false, filter: "all" })).toEqual({ matched: 1, updated: 1, skipped: 2 });
        expect(state.patch.mock.calls.flatMap(([keys]) => keys)).toEqual(["ABC-123"]);
        expect(ui.setProgress).toHaveBeenLastCalledWith(expect.anything(), expect.stringContaining("跳过 2 项"));
    });
    it("filters unreliable identities before any batch write and reports skipped rows", async () => {
        const rows = Array.from({ length: 76 }, (_, index) => `<div class="item"><a href="/v/${index}"><div class="video-title"><strong>ABC-${100 + index}</strong> Good</div></a></div>`).join("");
        const { state, ui } = setup(rows + '<div class="item"><a href="/v/unknown"><div class="video-title"><strong>FC2</strong> Unknown</div></a></div>');
        const result = await controller.run({ kind: "search" }, "favorite", { confirm: false, filter: "all" });
        expect(result).toEqual({ matched: 76, updated: 76, skipped: 1 });
        expect(state.patch.mock.calls.flatMap(([keys]) => keys)).toEqual(Array.from({ length: 76 }, (_, index) => `ABC-${100 + index}`));
        expect(state.patch.mock.calls.flatMap(([, , options]) => options.records).every((record) => record.stateEligibility?.eligible === true)).toBe(true);
        expect(ui.setProgress).toHaveBeenLastCalledWith(expect.anything(), expect.stringContaining("跳过 1 项"));
    });

    it("rechecks every scanned source before the first write when scanning another page changes a card", async () => {
        const { state } = setup('<div class="item"><a href="/v/a"><div class="video-title"><strong>ABC-123</strong> Good</div></a></div><a class="pagination-next" href="https://javdb.com/search?q=synthetic&page=2">Next</a>');
        controller.http.request.mockImplementation(async () => {
            dom.window.document.querySelector(".video-title strong").textContent = "FC2";
            return { data: '<div class="item"><a href="/v/b"><div class="video-title"><strong>ABC-124</strong> Good</div></a></div>' };
        });
        expect(await controller.run({ kind: "search" }, "favorite", { confirm: false, filter: "all" })).toEqual({ matched: 1, updated: 1, skipped: 1 });
        expect(state.patch.mock.calls.flatMap(([keys]) => keys)).toEqual(["ABC-124"]);
    });
    it("takes the default batch filter from the injected List Feature capability", async () => {
        const { state, setActiveFilter, createEvaluationContext } = setup();
        setActiveFilter("favorite");
        createEvaluationContext.mockResolvedValueOnce(createListEvaluationContext({ carMap: new Map([["ABC-123", { stateFlags: { favorite: true } }]]) }));

        await expect(controller.run({ kind: "search" }, "favorite", { confirm: false })).resolves.toEqual({ matched: 1, updated: 1 });

        expect(state.patch).toHaveBeenCalledOnce();
    });

    it("scans the frozen filter and writes matching records through the injected StateService", async () => {
        const { ui, state } = setup();

        await expect(controller.run({ kind: "search" }, "favorite", { confirm: false, filter: "all" })).resolves.toEqual({ matched: 1, updated: 1 });

        expect(state.patch).toHaveBeenCalledWith(["ABC-123"], { favorite: true }, {
            type: "actor-page-batch-state",
            records: [{ carNum: "ABC-123", url: "/v/ABC-123", names: "", publishTime: "2026-01-01", fc2Source: "fc2", stateEligibility: { eligible: true, reason: null } }],
        });
        expect(ui.setButtonsDisabled.mock.calls).toEqual([[true], [false]]);
        expect(ui.markWriting).toHaveBeenCalledOnce();
        expect(isBatchRunActive()).toBe(false);
    });

    it("preserves the blacklist transaction type and actor metadata in the shared batch runner", async () => {
        const { state } = setup();

        await expect(controller.run({ kind: "actor", displayName: "Actor", recordName: "Actor" }, "filter", { confirm: false, filter: "all" }))
            .resolves.toEqual({ matched: 1, updated: 1 });

        expect(state.patch).toHaveBeenCalledWith(["ABC-123"], { blocked: true }, {
            type: "actor-page-block",
            records: [{ carNum: "ABC-123", url: "/v/ABC-123", names: "Actor", publishTime: "2026-01-01", fc2Source: "fc2", stateEligibility: { eligible: true, reason: null } }],
        });
    });

    it("keeps search-page batch work single-flight and releases the run after completion", async () => {
        const { ui, createEvaluationContext } = setup("");
        let resolveContext;
        createEvaluationContext.mockImplementation(() => new Promise((resolve) => { resolveContext = resolve; }));

        const first = controller.run({ kind: "search" }, "favorite", { confirm: false, filter: "all" });
        const busy = await controller.run({ kind: "search" }, "favorite", { confirm: false, filter: "all" });
        expect(busy).toEqual({ cancelled: true, busy: true });
        expect(ui.error).toHaveBeenCalledWith("已有批量任务正在执行");
        resolveContext(createListEvaluationContext());
        await expect(first).resolves.toEqual({ matched: 0, updated: 0 });
        expect(isBatchRunActive()).toBe(false);
    });

    it("releases single-flight after evaluation fails and treats disposal as cancellation", async () => {
        const { ui, createEvaluationContext } = setup("");
        createEvaluationContext.mockRejectedValueOnce(new Error("context failed"));

        await expect(controller.run({ kind: "search" }, "favorite", { confirm: false })).rejects.toThrow("context failed");
        expect(ui.reportError).toHaveBeenCalledOnce();
        expect(ui.setButtonsDisabled).toHaveBeenLastCalledWith(false);
        expect(isBatchRunActive()).toBe(false);

        let resolveContext;
        createEvaluationContext.mockImplementationOnce(() => new Promise((resolve) => { resolveContext = resolve; }));
        const pending = controller.run({ kind: "search" }, "favorite", { confirm: false, filter: "all" });
        controller.dispose();
        resolveContext(createListEvaluationContext());
        await expect(pending).resolves.toEqual({ cancelled: true });
        expect(isBatchRunActive()).toBe(false);
    });

    it("releases batch ownership when progress initialization fails so the next run can proceed", async () => {
        const { ui, state } = setup();
        ui.beginProgress.mockImplementationOnce(() => { throw new Error("progress failed"); });

        await expect(controller.run({ kind: "search" }, "favorite", { confirm: false, filter: "all" }))
            .rejects.toThrow("progress failed");
        expect(isBatchRunActive()).toBe(false);
        expect(ui.setButtonsDisabled).toHaveBeenLastCalledWith(false);
        expect(state.patch).not.toHaveBeenCalled();

        await expect(controller.run({ kind: "search" }, "favorite", { confirm: false, filter: "all" }))
            .resolves.toEqual({ matched: 1, updated: 1 });
        expect(state.patch).toHaveBeenCalledOnce();
        expect(isBatchRunActive()).toBe(false);
    });

    it("does not start a batch when the Feature is disposed as confirmation returns", async () => {
        const { ui, scope, state } = setup("");
        let resolveConfirmation;
        ui.confirm.mockImplementation(() => new Promise((resolve) => { resolveConfirmation = resolve; }));
        const pending = controller.run({ kind: "search" }, "favorite");

        scope.disposed = true;
        controller.dispose();
        resolveConfirmation(true);

        await expect(pending).resolves.toEqual({ cancelled: true });
        expect(ui.beginProgress).not.toHaveBeenCalled();
        expect(state.patch).not.toHaveBeenCalled();
        expect(isBatchRunActive()).toBe(false);
    });

    it("warns that the TOP250 subtitle filter does not limit batch writes before confirmation", async () => {
        const { ui, state, hostAdapter } = setup();
        dom.reconfigure({ url: "https://javdb.com/rankings/top?jhs_subtitle=with" });
        hostAdapter.getPageContext = () => ({ kind: "top250-ranking" });
        ui.confirm.mockResolvedValueOnce(false);

        await expect(controller.run({ kind: "search" }, "favorite", { filter: "all" })).resolves.toEqual({ cancelled: true });

        expect(ui.confirm).toHaveBeenCalledWith(expect.stringContaining("当前字幕筛选只影响显示，不限制批量处理范围"), { confirmText: "收藏" });
        expect(state.patch).not.toHaveBeenCalled();
    });
});
