// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ActressInfoController } from "../src/features/identity/actress-info-controller.js";

afterEach(() => vi.unstubAllGlobals());

function createController({ html, url, setting = "yes", lookup = vi.fn(async () => null), profileUrl = vi.fn(() => "https://profiles.example/actor") }) {
    document.body.innerHTML = html;
    if (typeof globalThis.requestIdleCallback !== "function") vi.stubGlobal("requestIdleCallback", vi.fn(() => 1));
    if (typeof globalThis.cancelIdleCallback !== "function") vi.stubGlobal("cancelIdleCallback", vi.fn());
    const settings = new EventTarget();
    settings.value = { enableLoadActressInfo: setting };
    settings.snapshot = () => settings.value;
    const scope = new LifecycleScope("identity.actress-info");
    const service = { lookup, profileUrl };
    const diagnostics = { recordError: vi.fn() };
    const controller = new ActressInfoController({ document, location: new URL(url), service, settings, scope, diagnostics });
    return { controller, scope, settings, service, diagnostics, lookup, profileUrl };
}

function changeSetting(settings, value) {
    settings.value = { enableLoadActressInfo: value };
    settings.dispatchEvent(new CustomEvent("settings.changed", { detail: { names: ["enableLoadActressInfo"] } }));
}

describe("Actress info Feature", () => {
    it("renders detail tags as text and uses the existing actress panel position", async () => {
        const lookup = vi.fn(async () => ({
            url: "https://profiles.example/actor", birthday: "<img src=x>", age: "30", height: "160", weight: "45", threeSizeText: "B", braSize: "B70",
        }));
        const loaded = createController({
            html: '<div class="panel-block"><span>演员甲</span><i class="female"></i></div><div id="actor-heading"><strong>演员</strong></div>',
            url: "https://javdb.com/v/test", lookup,
        });
        loaded.controller.start();
        await vi.waitFor(() => expect(document.querySelector(".actress-info")).not.toBeNull());
        const block = document.querySelector("#actor-heading + .actress-info");
        expect(block?.classList.contains("panel-block")).toBe(true);
        expect(block?.querySelector("strong")?.textContent).toBe("演员甲:");
        expect(block?.querySelectorAll(".info-tag")).toHaveLength(3);
        expect(block?.querySelector(".info-tag")?.textContent).toBe("<img src=x> 30");
        expect(block?.querySelector("img")).toBeNull();
        expect(lookup).toHaveBeenCalledWith("演员甲", { scope: expect.any(LifecycleScope) });
        loaded.scope.dispose();
        expect(document.querySelector(".actress-info")).toBeNull();
    });

    it("renders the no-match state on an actor page without creating an unsafe link", async () => {
        const loaded = createController({
            html: '<div class="actor-section-name">演员甲, Actor A</div><div class="section-meta">演员乙</div>',
            url: "https://javdb.com/actors/actor1", lookup: vi.fn(async () => null),
        });
        await loaded.controller.mount();
        const info = document.querySelector(".actress-info");
        expect(info?.tagName).toBe("DIV");
        expect(info?.textContent).toBe("无此相关演员信息");
        expect(loaded.lookup).toHaveBeenCalledTimes(3);
        expect(loaded.profileUrl).not.toHaveBeenCalled();
        loaded.controller.dispose();
    });

    it("cancels late lookups on OFF and remounts once when switched back ON", async () => {
        let resolveInfo;
        const pending = new Promise((resolve) => { resolveInfo = resolve; });
        const lookup = vi.fn().mockReturnValueOnce(pending).mockResolvedValue({ url: "https://profiles.example/actor", birthday: "1990", age: "36", height: "160", weight: "45", threeSizeText: "B", braSize: "B70" });
        const loaded = createController({
            html: '<div class="panel-block"><span>演员甲</span><i class="female"></i></div><div><strong>演员</strong></div>',
            url: "https://javdb.com/v/test", lookup,
        });
        loaded.controller.start();
        await vi.waitFor(() => expect(lookup).toHaveBeenCalledOnce());
        const requestScope = lookup.mock.calls[0][1].scope;
        changeSetting(loaded.settings, "no");
        expect(requestScope.disposed).toBe(true);
        resolveInfo({ url: "https://profiles.example/actor", birthday: "1990", age: "36", height: "160", weight: "45", threeSizeText: "B", braSize: "B70" });
        await Promise.resolve();
        await Promise.resolve();
        expect(document.querySelector(".actress-info")).toBeNull();

        changeSetting(loaded.settings, "yes");
        await vi.waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
        await vi.waitFor(() => expect(document.querySelector(".actress-info")).not.toBeNull());
        expect(lookup.mock.calls[1][1].scope).not.toBe(requestScope);
        loaded.scope.dispose();
    });

    it("starts only after its owning idle Feature activates and cleans its request on disposal", async () => {
        vi.stubGlobal("requestIdleCallback", undefined);
        const loaded = createController({ html: "", url: "https://javdb.com/" });
        loaded.controller.start();
        await vi.waitFor(() => expect(loaded.controller.mountScope).not.toBeNull());
        expect(loaded.lookup).not.toHaveBeenCalled();
        loaded.scope.dispose();
        expect(loaded.controller.mountScope).toBeNull();
    });
});
