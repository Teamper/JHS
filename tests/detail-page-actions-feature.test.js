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
    const controller = new DetailPageActionsController({
        hostAdapter: {
            document, location: { href: "https://javdb.example/v/test" },
            readMovieInfo: () => ({ carNum, url: "https://javdb.example/v/test", actress: "actress", actors: "actor", publishTime: "2026-01-01" }),
            mountDetailActions: (row) => { if (!mount) return false; document.querySelector("#detail").append(row); return true; },
        },
        route: "detail", scope, settings: { snapshot: () => ({ enableMagnetsFilter: "no" }) },
        dialog: { open: vi.fn() }, subtitle: { search: vi.fn(async () => subtitleResults), download: vi.fn() },
        ui, notifications, events: { on: vi.fn((_name, listener) => { stateChanged = listener; return () => { stateChanged = null; }; }) }, diagnostics,
    });
    controller.getFeatureStateActionsAdapter().attach(stateActions);
    return { controller, scope, stateActions, ui, notifications, diagnostics, loadingClose, get stateChanged() { return stateChanged; } };
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
});
