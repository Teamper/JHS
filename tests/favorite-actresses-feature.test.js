// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { FavoriteActressesController } from "../src/features/library/favorite-actresses-controller.js";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";
import { BrowserStyleAdapter } from "../src/platform/browser/browser-style-adapter.js";

afterEach(() => {
    vi.unstubAllGlobals();
});

function createController({ html, url, actresses = [], add = vi.fn(async () => 1), remove = vi.fn(async () => true), detail = false }) {
    document.body.innerHTML = html;
    const scope = new LifecycleScope("library.favorite-actresses"), settings = new EventTarget();
    settings.value = { enableFavoriteActresses: "yes" };
    settings.snapshot = () => settings.value;
    const state = {
        getFavoriteActressList: vi.fn(async () => actresses),
        addFavoriteActressList: add,
        removeFavoriteActress: remove,
    };
    const $ = jquery;
    const controller = new FavoriteActressesController({
        document, location: new URL(url), hostAdapter: new JavDbHostAdapter(document, new URL(url)), jquery: $, state, settings, scope,
        diagnostics: { recordError: vi.fn() }, isDetailPage: detail,
        styles: new BrowserStyleAdapter(document),
    });
    return { controller, scope, settings, state, add, remove, $ };
}

describe("Library Feature favorite actresses", () => {
    it("owns visible borders, updates committed settings and releases styles on disable and disposal", async () => {
        vi.stubGlobal("requestIdleCallback", vi.fn(() => 1));
        const loaded = createController({ html: '<a id="actor" class="actor-female" title="Original" href="/actors/a">演员甲</a><a class="highlighted" id="other">Other</a>', url: "https://javdb.com/v/test", actresses: [{ starId: "a" }], detail: true });
        loaded.controller.start();
        loaded.settings.value = { enableFavoriteActresses: "yes", highlightedTagNumber: 2, highlightedTagColor: "#ce2222" };
        await loaded.controller.highlightActress();
        const actor = document.querySelector("#actor");
        expect(getComputedStyle(actor).borderTopWidth).toBe("2px");
        expect(getComputedStyle(actor).borderTopStyle).toBe("solid");
        expect(getComputedStyle(document.querySelector("#other")).borderTopWidth).toBe("");
        loaded.settings.value = { enableFavoriteActresses: "yes", highlightedTagNumber: 3, highlightedTagColor: "#123456" };
        loaded.settings.dispatchEvent(new CustomEvent("settings.changed", { detail: { names: ["highlightedTagNumber", "highlightedTagColor"] } }));
        await vi.waitFor(() => expect(getComputedStyle(actor).borderTopWidth).toBe("3px"));
        expect(getComputedStyle(actor).borderTopColor).toBe("rgb(18, 52, 86)");
        loaded.settings.value.enableFavoriteActresses = "no";
        await loaded.controller.highlightActress();
        expect(document.querySelector("#jhs-favorite-actresses-feature")).toBeNull();
        expect(actor.title).toBe("Original");
        expect(actor.classList.contains("jhs-favorite-actress-highlight")).toBe(false);
        loaded.settings.value.enableFavoriteActresses = "yes";
        await loaded.controller.highlightActress();
        expect(actor.classList.contains("highlighted")).toBe(true);
        loaded.scope.dispose();
        expect(document.querySelector("#jhs-favorite-actresses-feature")).toBeNull();
        expect(actor.title).toBe("Original");
    });

    it.each(["disable", "dispose", "refresh"])("rejects late favorite reads after %s", async (action) => {
        const loaded = createController({ html: '<a class="actor-female" href="/actors/a">演员甲</a>', url: "https://javdb.com/v/test", detail: true });
        let resolve;
        loaded.state.getFavoriteActressList.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
        const pending = loaded.controller.highlightActress();
        if (action === "dispose") loaded.controller.dispose();
        else {
            if (action === "disable") loaded.settings.value.enableFavoriteActresses = "no";
            await loaded.controller.highlightActress();
        }
        resolve([{ starId: "a" }]);
        await pending;
        expect(document.querySelector(".jhs-favorite-actress-highlight")).toBeNull();
        loaded.controller.dispose();
    });

    it("highlights canonical modern actresses only and restores their original title", async () => {
        const loaded = createController({
            html: '<div class="panel-block"><strong>演员:</strong><a id="female" class="actor-female" title="Original" href="/actors/a/?locale=zh">演员甲</a><a id="male" class="actor-male" href="/actors/a">演员乙</a><a id="unknown" href="/actors/a">未知</a></div>',
            url: "https://javdb.com/v/test", actresses: [{ starId: "a" }], detail: true,
        });
        await loaded.controller.highlightActress();
        expect([...document.querySelectorAll(".highlighted")].map((node) => node.id)).toEqual(["female"]);
        loaded.controller.dispose();
        expect(document.querySelector("#female").getAttribute("title")).toBe("Original");
    });
    it("highlights saved actors and immediately clears its decoration when the setting changes", async () => {
        vi.stubGlobal("requestIdleCallback", vi.fn(() => 1));
        vi.stubGlobal("cancelIdleCallback", vi.fn());
        const loaded = createController({
            html: '<div><a id="actor" href="/actors/actor1">演员甲</a><i class="female"></i></div>',
            url: "https://javdb.com/v/fixture", actresses: [{ starId: "actor1" }], detail: true,
        });
        loaded.controller.start();
        await loaded.controller.highlightActress();
        expect(document.querySelector("#actor").classList.contains("highlighted")).toBe(true);
        expect(document.querySelector("#actor").getAttribute("title")).toContain("已收藏演员，前往设置调整高亮");

        loaded.settings.value = { enableFavoriteActresses: "no" };
        loaded.settings.dispatchEvent(new CustomEvent("settings.changed", { detail: { names: ["enableFavoriteActresses"] } }));
        await vi.waitFor(() => expect(document.querySelector("#actor").classList.contains("highlighted")).toBe(false));
        expect(document.querySelector("#actor").hasAttribute("title")).toBe(false);
        loaded.scope.dispose();
    });

    it("adds and removes a JavDB actor using the injected state service and legacy event semantics", async () => {
        vi.stubGlobal("requestIdleCallback", vi.fn(() => 1));
        vi.stubGlobal("cancelIdleCallback", vi.fn());
        const loaded = createController({
            html: '<div class="actor-section-name">演员甲, Actor A</div><div class="section-meta">演员乙</div><span class="avatar" style="background-image:url(https://img.example/avatar.jpg)"></span><a id="button-collect-actor" href="/actors/actor1/collect">收藏</a><a id="button-uncollect-actor" href="/actors/actor1/uncollect">取消</a>',
            url: "https://javdb.com/actors/actor1",
        });
        loaded.controller.start();
        const changes = [];
        document.addEventListener("actress-state-changed", (event) => changes.push(event.detail.starId));

        document.querySelector("#button-collect-actor").dispatchEvent(new Event("click", { bubbles: true }));
        await vi.waitFor(() => expect(loaded.add).toHaveBeenCalledOnce());
        expect(loaded.add).toHaveBeenCalledWith([expect.objectContaining({
            starId: "actor1", name: "演员甲", allName: ["演员甲", "Actor A", "演员乙"],
            avatar: "https://img.example/avatar.jpg",
        })]);
        expect(changes).toEqual(["actor1"]);

        document.querySelector("#button-uncollect-actor").dispatchEvent(new Event("click", { bubbles: true }));
        await vi.waitFor(() => expect(loaded.remove).toHaveBeenCalledWith("actor1"));
        expect(changes).toEqual(["actor1", "actor1"]);
        loaded.scope.dispose();
    });

    it("handles confirmed uncollect through delegated jQuery events and releases the listener", async () => {
        vi.stubGlobal("requestIdleCallback", vi.fn(() => 1));
        vi.stubGlobal("cancelIdleCallback", vi.fn());
        const loaded = createController({
            html: '<a id="button-uncollect-actor" href="/actors/actor2/uncollect">取消</a>',
            url: "https://javdb.com/actors/actor2",
        });
        loaded.controller.start();
        loaded.$("#button-uncollect-actor").trigger(loaded.$.Event("confirm:complete", { detail: [true] }));
        await vi.waitFor(() => expect(loaded.remove).toHaveBeenCalledOnce());
        loaded.scope.dispose();
        loaded.$("#button-uncollect-actor").trigger(loaded.$.Event("confirm:complete", { detail: [true] }));
        await Promise.resolve();
        expect(loaded.remove).toHaveBeenCalledOnce();
    });

    it("restores a replaced avatar and removes its owned placeholder on disposal", async () => {
        vi.stubGlobal("requestIdleCallback", vi.fn(() => 1));
        vi.stubGlobal("cancelIdleCallback", vi.fn());
        const loaded = createController({
            html: '<div class="section-columns"></div>',
            url: "https://javdb.com/actors/actor3",
            actresses: [{ starId: "actor3", avatar: "https://img.example/saved.jpg" }],
        });
        loaded.controller.start();
        await loaded.controller.replaceActressAvatar();
        const avatar = document.querySelector(".section-columns .avatar");
        expect(avatar.style.backgroundImage).toContain("saved.jpg");
        expect(document.querySelector(".jhs-favorite-actress-avatar")).not.toBeNull();
        loaded.scope.dispose();
        expect(document.querySelector(".jhs-favorite-actress-avatar")).toBeNull();
    });
});
