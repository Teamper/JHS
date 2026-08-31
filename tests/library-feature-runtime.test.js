// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { LibraryController } from "../src/features/library/library-controller.js";

describe("Library FeatureRuntime ownership", () => {
    it("passes the feature scope to the migrated history contribution once", async () => {
        const scope = new LifecycleScope("feature:library"), repository = {}, historyPlugin = {
            handle: vi.fn(async () => {}),
            get historyRepository() { return repository; },
        }, statePlugin = { handle: vi.fn(async () => {}) }, blacklistPlugin = {
            openBlacklistDialog: vi.fn(),
            parseAndSaveFilterInfo: vi.fn(),
        }, favoritePlugin = { handle: vi.fn(async () => {}) };
        const controller = new LibraryController({ historyPlugin, statePlugin, blacklistPlugin, favoritePlugin, route: "other", scope });

        await controller.start();
        await controller.start();

        expect(historyPlugin.handle).toHaveBeenCalledOnce();
        expect(historyPlugin.handle).toHaveBeenCalledWith({ scope });
        expect(statePlugin.handle).toHaveBeenCalledOnce();
        expect(statePlugin.handle).toHaveBeenCalledWith({ scope });
        expect(favoritePlugin.handle).toHaveBeenCalledOnce();
        expect(favoritePlugin.handle).toHaveBeenCalledWith({ scope });
        expect(controller.getApi().getHistoryRepository()).toBe(repository);
        expect(controller.getApi().hasBlacklist).toBe(true);
        controller.getApi().openBlacklistDialog("event");
        expect(blacklistPlugin.openBlacklistDialog).toHaveBeenCalledWith("event");
        controller.dispose();
        expect(scope.disposed).toBe(false);
        scope.dispose();
    });

    it("binds the native title keyword filter through declared storage services", async () => {
        document.body.innerHTML = '<div class="title"><strong>测试标题</strong></div>';
        const storage = { get: vi.fn(async () => []), set: vi.fn(async () => {}) };
        const eventBus = { emit: vi.fn(async () => {}) };
        const scope = { assertActive: vi.fn(), addCleanup: vi.fn() };
        const controller = new LibraryController({
            hostAdapter: { site: "javdb", document, location: window.location }, storage,
            settings: { snapshot: () => ({ enableTitleSelectFilter: "yes" }) }, eventBus,
            storageMutation: { runExclusive: vi.fn(operation => operation()) }, route: "detail", scope,
        });
        vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "  标题\n关键词  " });
        vi.stubGlobal("utils", { q: vi.fn((_event, _message, callback) => void callback()), closePage: vi.fn() });

        await controller.start();
        const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 20 });
        document.querySelector(".title strong")?.dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(event.defaultPrevented).toBe(true);
        expect(storage.set).toHaveBeenCalledWith("filter_keyword_title", ["标题 关键词"]);
        expect(eventBus.emit).toHaveBeenCalledWith("filter-rules-changed", { scope: "title-keyword" });
        expect(controller.getApi().hasKeywordFilter).toBe(true);
    });

    it("keeps the feature usable when the optional history contribution is unavailable", async () => {
        const scope = new LifecycleScope("feature:library"), controller = new LibraryController({ scope });

        await expect(controller.start()).resolves.toBeUndefined();
        expect(controller.getApi().getHistoryRepository()).toBeNull();
        expect(controller.getApi().hasBlacklist).toBe(false);
        scope.dispose();
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
