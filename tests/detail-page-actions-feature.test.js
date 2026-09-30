// @vitest-environment jsdom
import jquery from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { DetailPageActionsController } from "../src/features/detail/detail-page-actions-controller.js";

const $ = jquery;
afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

function createFixture({ carNum = "ABC123", mount = true, subtitleResults = [] } = {}) {
    document.body.innerHTML = '<div id="detail"></div><div id="preview-video"></div>';
    let stateChanged = null;
    const scope = new LifecycleScope("test:detail-page-actions");
    const loadingClose = vi.fn();
    const stateActions = {
        stateController: {}, bind: vi.fn(() => ({})), showStatus: vi.fn(), getStateRecord: vi.fn(() => ({ carNum })),
        getStateBinding: vi.fn(() => ({})), favoriteOne: vi.fn(), hasDownOne: vi.fn(), hasWatchOne: vi.fn(), filterOne: vi.fn(),
    };
    const ui = {
        jquery: $, confirm: vi.fn(), closePage: vi.fn(), loading: vi.fn(() => ({ close: loadingClose })),
        getResponsiveArea: vi.fn((area) => area), setupEscClose: vi.fn(), download: vi.fn(),
    };
    const notifications = { error: vi.fn(), info: vi.fn() };
    const diagnostics = { recordError: vi.fn() };
    const dialog = { open: vi.fn(() => 7), close: vi.fn() };
    const controller = new DetailPageActionsController({
        hostAdapter: {
            document, location: { href: "https://javdb.example/v/test" },
            readMovieInfo: () => ({ carNum, url: "https://javdb.example/v/test", actress: "actress", actors: "actor", publishTime: "2026-01-01" }),
            mountDetailActions: (row) => { if (!mount) return false; document.querySelector("#detail").append(row); return true; },
        },
        route: "detail", scope, settings: { snapshot: () => ({ enableMagnetsFilter: "no" }) },
        dialog, subtitle: { search: vi.fn(async () => subtitleResults), download: vi.fn() },
        ui, notifications, events: { on: vi.fn((_name, listener) => { stateChanged = listener; return () => { stateChanged = null; }; }) }, diagnostics,
    });
    controller.getFeatureStateActionsAdapter().attach(stateActions);
    return { controller, scope, stateActions, ui, notifications, diagnostics, dialog, loadingClose, get stateChanged() { return stateChanged; } };
}

describe("Detail page actions Feature controller", () => {
    it("mounts host controls, binds state, forwards state changes, and cleans up on disposal", () => {
        const fixture = createFixture();

        expect(fixture.controller.start()).toBe(true);
        expect(document.querySelectorAll("[data-jhs-detail-actions]")).toHaveLength(1);
        expect(document.querySelector("#favoriteBtn")).not.toBeNull();
        expect(fixture.stateActions.bind).toHaveBeenCalledWith({ root: document, carNum: "ABC-123" });
        fixture.stateChanged({ carNums: ["ABC-123"] });
        expect(fixture.stateActions.showStatus).toHaveBeenCalledWith("ABC-123");

        fixture.scope.dispose();
        expect(document.querySelector("[data-jhs-detail-actions]")).toBeNull();
        expect(fixture.stateChanged).toBeNull();
    });

    it("does not report the contribution active when the host has no mount point", () => {
        const fixture = createFixture({ mount: false });

        expect(fixture.controller.start()).toBe(false);
        expect(document.querySelector("[data-jhs-detail-actions]")).toBeNull();
        fixture.scope.dispose();
    });

    it("disables identity-dependent actions and closes the loading indicator after an empty subtitle search", async () => {
        const fixture = createFixture({ carNum: null });
        fixture.controller.start();
        expect(document.querySelector("#favoriteBtn").disabled).toBe(true);
        expect(fixture.diagnostics.recordError).toHaveBeenCalledWith(expect.objectContaining({ contributionId: "detail.page-state-actions" }));

        await fixture.controller.searchXunLeiSubtitle("");
        expect(fixture.notifications.error).toHaveBeenCalledWith("迅雷中找不到相关字幕!");
        expect(fixture.loadingClose).toHaveBeenCalledOnce();
        fixture.scope.dispose();
    });

    it("waits for magnet content, prevents duplicate dialogs and discards late results", async () => {
        const fixture = createFixture();
        let resolveHub;
        const createMagnetHub = vi.fn(() => new Promise(resolve => { resolveHub = resolve; }));
        fixture.controller.attachFeatureMagnetHubAdapter({ createMagnetHub });
        fixture.controller.start();
        $("#magnetSearchBtn").trigger("click").trigger("click");
        expect(fixture.dialog.open).toHaveBeenCalledOnce();
        const options = fixture.dialog.open.mock.calls[0][0];
        expect(typeof options.content).toBe("string");
        const root = $("<div class='layui-layer'></div>").append(options.content).appendTo(document.body);
        options.success(root);
        const content = root.find(".jhs-magnet-dialog");
        expect(content.text()).toContain("正在加载");
        await vi.waitFor(() => expect(createMagnetHub).toHaveBeenCalledOnce());
        resolveHub($("<div>磁力结果</div>"));
        await vi.waitFor(() => expect(content.text()).toContain("磁力结果"));
        options.end();
        $("#magnetSearchBtn").trigger("click");
        const later = fixture.dialog.open.mock.calls[1][0];
        const laterRoot = $("<div class='layui-layer'></div>").append(later.content).appendTo(document.body);
        later.success(laterRoot);
        await vi.waitFor(() => expect(createMagnetHub).toHaveBeenCalledTimes(2));
        later.end();
        resolveHub($("<div>迟到的结果</div>"));
        await Promise.resolve();
        expect(laterRoot.text()).not.toContain("迟到的结果");
        fixture.scope.dispose();
    });

    it("shows a retry after magnet initialization fails and closes on feature detach", async () => {
        const fixture = createFixture();
        const adapter = { createMagnetHub: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue($("<div>磁力结果</div>")) };
        fixture.controller.attachFeatureMagnetHubAdapter(adapter);
        fixture.controller.start();
        $("#magnetSearchBtn").trigger("click");
        const options = fixture.dialog.open.mock.calls[0][0];
        const root = $("<div class='layui-layer'></div>").append(options.content).appendTo(document.body);
        options.success(root);
        const content = root.find(".jhs-magnet-dialog");
        await vi.waitFor(() => expect(content.find("button").text()).toBe("重试"));
        content.find("button").trigger("click");
        await vi.waitFor(() => expect(content.text()).toContain("磁力结果"));
        fixture.controller.detachFeatureMagnetHubAdapter(adapter);
        expect(fixture.dialog.close).toHaveBeenCalledExactlyOnceWith(7);
        fixture.scope.dispose();
    });
});
