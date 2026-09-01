import { describe, expect, it, vi } from "vitest";
import { CompatibilityController } from "../src/features/compatibility/compatibility-controller.js";
import { DetailController } from "../src/features/detail/detail-controller.js";
import detailManifest from "../src/features/detail/manifest.js";
import { PORT, SERVICE } from "../src/contracts/tokens.js";
import { StatsController } from "../src/features/stats/stats-controller.js";

function createScope() {
    return {
        assertActive: vi.fn(),
        listen: vi.fn((target, type, listener, options) => {
            target.addEventListener?.(type, listener, options);
            return () => target.removeEventListener?.(type, listener, options);
        }),
    };
}

describe("feature controller ownership", () => {
    it("starts native compatibility enhancements only once", async () => {
        const scope = createScope(), document = { querySelectorAll: vi.fn(() => []), addEventListener: vi.fn(), removeEventListener: vi.fn() }, controller = new CompatibilityController({
            hostAdapter: { site: "javbus", document, location: { pathname: "/", href: "https://javbus.com/" } },
            storage: { get: vi.fn(async () => []) }, state: {}, features: {}, styles: { register: vi.fn() }, ui: {}, route: "other", scope,
        });
        await controller.start();
        await controller.start();

        expect(scope.assertActive).toHaveBeenCalledTimes(2);
        expect(document.addEventListener).toHaveBeenCalledOnce();
        expect(controller.getApi()).toEqual({ hasEnhancements: true });
    });

    it("keeps a disabled compatibility contribution inert", async () => {
        const scope = createScope(), document = { querySelectorAll: vi.fn(() => []), addEventListener: vi.fn(), removeEventListener: vi.fn() }, controller = new CompatibilityController({
            hostAdapter: { site: "javdb", document, location: { pathname: "/", href: "https://javdb.com/" } },
            storage: { get: vi.fn(async () => []) }, state: {}, features: {}, styles: { register: vi.fn() }, ui: {}, enabled: false, route: "other", scope,
        });
        await controller.start();

        expect(document.addEventListener).not.toHaveBeenCalled();
        expect(controller.getApi()).toEqual({ hasEnhancements: false });
    });

    it("starts the feature-owned detail workspace controller", async () => {
        const scope = createScope(), hostAdapter = {
            locateDetailRoot: vi.fn(() => null),
            locateDetailSlots: vi.fn(() => ({})),
            readMovieRef: vi.fn(() => ({ carNum: "ABC-1" })),
        }, workspaceController = { start: vi.fn() };
        const controller = new DetailController({ hostAdapter, workspaceController, scope, enabledContributions: ["detail.workspace"] });

        await expect(controller.start()).resolves.toMatchObject({ movieRef: { carNum: "ABC-1" }, contributions: ["detail.workspace"] });
        expect(workspaceController.start).toHaveBeenCalledOnce();
        expect(hostAdapter.locateDetailRoot).toHaveBeenCalledOnce();
    });

    it("runs native detail enhancement before the workspace contribution", async () => {
        const scope = createScope(), hostAdapter = {
            locateDetailRoot: vi.fn(() => null),
            locateDetailSlots: vi.fn(() => ({})),
            readMovieRef: vi.fn(() => null),
        }, calls = [], fc2Plugin = { handle: vi.fn(() => calls.push("fc2")) }, nativeController = { start: vi.fn(() => calls.push("native")) }, workspaceController = { start: vi.fn(() => calls.push("workspace")) }, reviewController = { start: vi.fn(() => calls.push("reviews")) }, relatedController = { start: vi.fn(() => calls.push("related")) }, pageActionsPlugin = { handle: vi.fn(() => calls.push("page-actions")) }, magnetPlugin = { handle: vi.fn(() => calls.push("magnet")) }, previewPlugin = { handle: vi.fn(() => calls.push("preview")) }, externalSitesPlugin = { handle: vi.fn(() => calls.push("external-sites")) }, screenshotController = { start: vi.fn(() => calls.push("screenshot")) };
        const controller = new DetailController({ hostAdapter, fc2Plugin, nativeController, workspaceController, reviewController, relatedController, pageActionsPlugin, screenshotController, magnetPlugin, previewPlugin, externalSitesPlugin, scope, enabledContributions: [] });

        await controller.start();

        expect(calls).toEqual(["fc2", "native", "workspace", "reviews", "related", "page-actions", "magnet", "preview", "external-sites", "screenshot"]);
        expect(fc2Plugin.handle).toHaveBeenCalledWith(expect.objectContaining({ scope }));
        expect(nativeController.start).toHaveBeenCalledOnce();
        expect(workspaceController.start).toHaveBeenCalledOnce();
        expect(reviewController.start).toHaveBeenCalledOnce();
        expect(relatedController.start).toHaveBeenCalledOnce();
        expect(pageActionsPlugin.handle).toHaveBeenCalledWith(expect.objectContaining({ scope }));
        expect(screenshotController.start).toHaveBeenCalledOnce();
        expect(magnetPlugin.handle).toHaveBeenCalledWith({ scope });
        expect(previewPlugin.handle).toHaveBeenCalledWith(expect.objectContaining({ scope, detailActions: pageActionsPlugin }));
        expect(externalSitesPlugin.handle).toHaveBeenCalledWith({ scope });
    });

    it("uses JavBus-specific contribution IDs for native and preview detail surfaces", async () => {
        const scope = createScope(), hostAdapter = {
            site: "javbus",
            locateDetailRoot: vi.fn(() => null),
            locateDetailSlots: vi.fn(() => ({})),
            readMovieRef: vi.fn(() => null),
        }, calls = [], isolateContribution = vi.fn((id, operation) => {
            calls.push(id);
            return operation();
        });
        const controller = new DetailController({
            hostAdapter,
            nativeController: { start: vi.fn() },
            previewPlugin: { handle: vi.fn() },
            isolateContribution,
            scope,
            enabledContributions: [],
        });

        await controller.start();

        expect(calls).toContain("detail.javbus-native");
        expect(calls).toContain("detail.javbus-preview");
        expect(calls).not.toContain("detail.javdb-native");
        expect(calls).not.toContain("detail.javdb-preview");
    });

    it("does not mark site-ineligible detail contributions active", async () => {
        const scope = createScope(), hostAdapter = {
            site: "javbus",
            locateDetailRoot: vi.fn(() => null),
            locateDetailSlots: vi.fn(() => ({})),
            readMovieRef: vi.fn(() => null),
        }, isolateContribution = vi.fn((_id, operation) => operation());
        const controller = new DetailController({ hostAdapter, isolateContribution, scope, enabledContributions: ["detail.fc2-owned", "detail.related"] });

        await controller.start();

        expect(isolateContribution).not.toHaveBeenCalled();
    });

    it("mounts only the FC2-owned contribution on an owned-detail route", async () => {
        const scope = createScope(), hostAdapter = { locateDetailRoot: vi.fn(), locateDetailSlots: vi.fn(), readMovieRef: vi.fn() }, calls = [], fc2Plugin = { handle: vi.fn(() => calls.push("fc2")) }, nativeController = { start: vi.fn(() => calls.push("native")) };
        const controller = new DetailController({ hostAdapter, fc2Plugin, nativeController, ownedDetail: true, scope, enabledContributions: ["detail.fc2-owned"] });

        await controller.start();

        expect(calls).toEqual(["fc2"]);
        expect(hostAdapter.locateDetailRoot).not.toHaveBeenCalled();
        expect(fc2Plugin.handle).toHaveBeenCalledWith({ scope });
    });

    it("does not pass a disabled list FC2 lookup into owned detail", async () => {
        const run = async (lookupEnabled) => {
            const scope = createScope(), fc2Lookup = { resolveMovieId: vi.fn() }, captured = {};
            const deps = {
                [PORT.host]: { site: "javdb", locateDetailRoot: vi.fn(), locateDetailSlots: vi.fn(), readMovieRef: vi.fn() },
                [SERVICE.fc2Lookup]: fc2Lookup,
                [SERVICE.fc2OwnedDetail]: { create: vi.fn((options) => { captured.options = options; return { handle: vi.fn() }; }) },
            };
            const runtime = {
                enabledContributions: ["detail.fc2-owned"], route: "owned-detail", scope,
                isContributionEnabled: vi.fn(() => lookupEnabled),
                isolateContribution: vi.fn((_id, operation) => operation()),
            };

            await detailManifest.activate(deps, runtime);
            return { captured, runtime, fc2Lookup };
        };

        const disabled = await run(false), enabled = await run(true);
        expect(disabled.runtime.isContributionEnabled).toHaveBeenCalledWith("list", "list.fc2-lookup");
        expect(disabled.captured.options.fc2Lookup).toBeNull();
        expect(enabled.captured.options.fc2Lookup).toBe(enabled.fc2Lookup);
    });

    it("starts the native stats contribution and exposes its action", async () => {
        const scope = createScope(), controller = new StatsController({
            diagnostics: { exportSnapshot: vi.fn(() => ({ activeFeatures: [], errors: [] })) },
            dialog: { open: vi.fn(), close: vi.fn() }, movie: {}, storage: {}, state: { getActivityLog: vi.fn() }, features: {}, route: "detail", scope,
            ui: {},
        });
        await controller.start();

        expect(scope.assertActive).toHaveBeenCalledOnce();
        expect(controller.getApi().openDialog).toEqual(expect.any(Function));
        expect(controller.getApi().hasDashboard).toBe(true);
    });

});
