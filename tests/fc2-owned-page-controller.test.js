import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { Fc2OwnedPageController } from "../src/features/detail/fc2-owned-page-controller.js";

function createPage(query = "?movieId=movie-123&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123&source=fc2") {
    const dom = new JSDOM('<body><section><p id="host-content">Original host content</p></section></body>', { url: `https://javdb.com/users/collection_codes${query}` });
    const scope = new LifecycleScope("feature:fc2-owned-page-test");
    const context = { destroy: vi.fn() };
    const adapter = {
        resolveMovieIdForRecord: vi.fn(async () => "resolved-movie"),
        resolveFc2Source: vi.fn(async () => "123av"),
        mountFc2Detail: vi.fn((host) => {
            const workspace = dom.window.document.createElement("div");
            workspace.className = "jhs-fc2-workspace";
            host.append(workspace);
            return context;
        }),
    };
    const onError = vi.fn();
    const controller = new Fc2OwnedPageController({
        document: dom.window.document, window: dom.window, location: dom.window.location,
        scope, adapter, onError,
    });
    return { dom, scope, context, adapter, onError, controller };
}

describe("Fc2OwnedPageController", () => {
    it("mounts the native FC2 workspace and restores the host surface on pagehide", async () => {
        const { dom, scope, context, adapter, controller } = createPage("?movieId=search&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123&source=unknown");
        const host = dom.window.document.querySelector("section");

        await expect(controller.start()).resolves.toBe(true);
        expect(adapter.resolveMovieIdForRecord).toHaveBeenCalledExactlyOnceWith("FC2-123", "https://fc2ppvdb.com/articles/123");
        expect(adapter.resolveFc2Source).toHaveBeenCalledExactlyOnceWith({ url: "https://fc2ppvdb.com/articles/123" });
        expect(adapter.mountFc2Detail).toHaveBeenCalledExactlyOnceWith(host, {
            movieId: "resolved-movie", carNum: "FC2-123", url: "https://fc2ppvdb.com/articles/123", source: "123av", mode: "page",
        });
        expect(host.querySelector(".jhs-fc2-workspace")).not.toBeNull();

        dom.window.dispatchEvent(new dom.window.Event("pagehide"));
        expect(context.destroy).toHaveBeenCalledOnce();
        expect(host.querySelector("#host-content")?.textContent).toBe("Original host content");
        scope.dispose();
        dom.window.close();
    });

    it("does not mount a late resolution after the Feature is disposed", async () => {
        const { dom, scope, adapter, controller } = createPage("?movieId=search&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123");
        let resolveMovieId;
        adapter.resolveMovieIdForRecord.mockImplementation(() => new Promise((resolve) => { resolveMovieId = resolve; }));
        const startup = controller.start();
        controller.dispose();
        resolveMovieId("late-movie");

        await expect(startup).resolves.toBe(false);
        expect(adapter.resolveFc2Source).not.toHaveBeenCalled();
        expect(adapter.mountFc2Detail).not.toHaveBeenCalled();
        expect(dom.window.document.querySelector("#host-content")?.textContent).toBe("Original host content");
        scope.dispose();
        dom.window.close();
    });

    it("renders incomplete parameters as text and restores the original content on disposal", async () => {
        const { dom, scope, adapter, controller } = createPage("?movieId=movie-123&carNum=%3Cimg%20src=x%3E");
        const host = dom.window.document.querySelector("section");

        await expect(controller.start()).resolves.toBe(true);
        expect(host.querySelector(".jhs-fc2-state")?.textContent).toBe("FC2 详情参数不完整");
        expect(host.querySelector("img")).toBeNull();
        expect(adapter.mountFc2Detail).not.toHaveBeenCalled();
        scope.dispose();
        expect(host.querySelector("#host-content")?.textContent).toBe("Original host content");
        dom.window.close();
    });
});
