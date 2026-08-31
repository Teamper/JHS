// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { LibraryController } from "../src/features/library/library-controller.js";

describe("Library FeatureRuntime ownership", () => {
    it("passes the feature scope to the migrated history contribution once", async () => {
        const scope = new LifecycleScope("feature:library"), repository = {}, historyController = {
            start: vi.fn(async () => {}),
            get historyRepository() { return repository; },
        }, blacklistPlugin = {
            openBlacklistDialog: vi.fn(),
            parseAndSaveFilterInfo: vi.fn(),
        };
        const controller = new LibraryController({ historyController, blacklistPlugin, favoriteActressesEnabled: false, route: "other", scope });

        await controller.start();
        await controller.start();

        expect(historyController.start).toHaveBeenCalledOnce();
        expect(historyController.start).toHaveBeenCalledWith({ scope });
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

    it("highlights a saved actress and replaces the actor page avatar through native DOM", async () => {
        document.body.innerHTML = '<a href="/actors/actor-1">演员甲</a><span class="female">演员甲</span><div class="section-columns"></div><div class="actor-section-name">演员甲</div>';
        const scope = new LifecycleScope("feature:library"), storage = { get: vi.fn(async () => [{ starId: "actor-1", avatar: "https://cdn.example/avatar.jpg" }]), set: vi.fn(async () => {}) };
        const controller = new LibraryController({
            hostAdapter: { site: "javdb", document, location: { href: "https://javdb.com/actors/actor-1", pathname: "/actors/actor-1" } },
            storage, settings: { snapshot: () => ({}) }, route: "detail", scope,
        });

        await controller.start();

        expect(document.querySelector('a[href="/actors/actor-1"]')?.classList.contains("highlighted")).toBe(true);
        expect(document.querySelector('a[href="/actors/actor-1"]')?.getAttribute("title")).toContain("高亮已收藏演员");
        expect(document.querySelector(".avatar")?.style.backgroundImage).toContain("avatar.jpg");
        scope.dispose();
    });

    it("persists actor collection through the mutation coordinator and emits the native state event", async () => {
        document.body.innerHTML = '<div class="section-columns"></div><div class="actor-section-name">演员甲, 别名甲</div><a id="button-collect-actor" href="/actors/actor-1/collect">收藏</a>';
        const scope = new LifecycleScope("feature:library"), values = [], storage = { get: vi.fn(async () => []), set: vi.fn(async (_key, value) => values.push(value)) }, eventBus = { emit: vi.fn(async () => {}) };
        const controller = new LibraryController({
            hostAdapter: { site: "javdb", document, location: { href: "https://javdb.com/actors/actor-1", pathname: "/actors/actor-1" } },
            storage, settings: { snapshot: () => ({}) }, eventBus, storageMutation: { runExclusive: vi.fn((operation) => operation()) }, route: "other", scope,
        });

        await controller.start();
        const button = document.querySelector("#button-collect-actor");
        button?.addEventListener("click", (event) => event.preventDefault(), { once: true });
        button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(values[0][0]).toMatchObject({ starId: "actor-1", name: "演员甲", allName: ["演员甲", "别名甲"] });
        expect(eventBus.emit).toHaveBeenCalledWith("actress-state-changed", { starId: "actor-1" });
        scope.dispose();
    });

    it("removes an actress on the confirmed uncollect event", async () => {
        document.body.innerHTML = '<a id="button-uncollect-actor" href="/actors/actor-1/uncollect">取消收藏</a>';
        const scope = new LifecycleScope("feature:library"), storage = { get: vi.fn(async () => [{ starId: "actor-1" }]), set: vi.fn(async (_key, value) => { storage.value = value; }) }, eventBus = { emit: vi.fn(async () => {}) };
        const controller = new LibraryController({
            hostAdapter: { site: "javdb", document, location: { href: "https://javdb.com/actors/actor-1", pathname: "/actors/actor-1" } },
            storage, settings: { snapshot: () => ({}) }, eventBus, route: "other", scope,
        });

        await controller.start();
        document.querySelector("#button-uncollect-actor")?.dispatchEvent(new CustomEvent("confirm:complete", { detail: [true], bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(storage.value).toEqual([]);
        scope.dispose();
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
