import { describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { Fc2OwnedPageController } from "../src/features/detail/fc2-owned-page-controller.js";

const originalContent = '<p id="host-content">Original host content</p>';
const mainContent = `<section class="section"><div class="container">${originalContent}</div></section>`;
const domainModal = '<div class="modal new-domain-modal" style="display:none"><section class="modal-card-body"><p id="domain-notice">Domain notice</p></section></div>';
const imageModal = '<div class="modal search-image-modal" style="display:none"><section class="modal-card-body"><p id="image-notice">Image notice</p></section></div>';

function createPage(query = "?movieId=movie-123&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123&source=fc2", body = domainModal + mainContent + imageModal) {
    const dom = new JSDOM(`<body><nav id="navigation">Navigation</nav>${body}</body>`, { url: `https://javdb.com/users/collection_codes${query}` });
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
        const host = dom.window.document.querySelector("body > section.section > .container");
        const original = host.firstChild, click = vi.fn();
        original.addEventListener("click", click);

        await expect(controller.start()).resolves.toBe(true);
        expect(adapter.resolveMovieIdForRecord).toHaveBeenCalledExactlyOnceWith("FC2-123", "https://fc2ppvdb.com/articles/123");
        expect(adapter.resolveFc2Source).toHaveBeenCalledExactlyOnceWith({ url: "https://fc2ppvdb.com/articles/123" });
        expect(adapter.mountFc2Detail).toHaveBeenCalledExactlyOnceWith(host, {
            movieId: "resolved-movie", carNum: "FC2-123", url: "https://fc2ppvdb.com/articles/123", source: "123av", mode: "page",
        });
        expect(host.querySelector(".jhs-fc2-workspace")).not.toBeNull();
        await expect(controller.start()).resolves.toBe(false);
        expect(adapter.mountFc2Detail).toHaveBeenCalledOnce();

        dom.window.dispatchEvent(new dom.window.Event("pagehide"));
        expect(context.destroy).toHaveBeenCalledOnce();
        expect(host.querySelector("#host-content")?.textContent).toBe("Original host content");
        expect(host.firstChild).toBe(original);
        original.dispatchEvent(new dom.window.Event("click"));
        expect(click).toHaveBeenCalledOnce();
        scope.dispose();
        dom.window.close();
    });

    it("does not mount a late resolution after the Feature is disposed", async () => {
        const { dom, scope, adapter, controller } = createPage("?movieId=search&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123");
        let resolveMovieId;
        adapter.resolveMovieIdForRecord.mockImplementation(() => new Promise((resolve) => { resolveMovieId = resolve; }));
        const startup = controller.start();
        scope.dispose();
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
        const host = dom.window.document.querySelector("body > section.section > .container");

        await expect(controller.start()).resolves.toBe(true);
        expect(host.querySelector(".jhs-fc2-state")?.textContent).toBe("FC2 详情参数不完整");
        expect(host.querySelector("img")).toBeNull();
        expect(adapter.mountFc2Detail).not.toHaveBeenCalled();
        scope.dispose();
        expect(host.querySelector("#host-content")?.textContent).toBe("Original host content");
        dom.window.close();
    });

    it.each([
        ["before", domainModal + mainContent],
        ["after", mainContent + imageModal],
        ["both", domainModal + mainContent + imageModal],
    ])("preserves navigation and modal sections %s the main content", async (_, body) => {
        const { dom, scope, adapter, controller } = createPage(undefined, body);
        const document = dom.window.document, host = document.querySelector("body > section.section > .container");
        const navigation = document.querySelector("nav"), modalSections = [...document.querySelectorAll(".modal section")];
        const originalModalNodes = modalSections.map(section => [...section.childNodes]);
        await expect(controller.start()).resolves.toBe(true);
        expect(adapter.mountFc2Detail.mock.calls[0][0]).toBe(host);
        expect(document.querySelectorAll(".jhs-fc2-workspace")).toHaveLength(1);
        expect(document.querySelector("nav")).toBe(navigation);
        modalSections.forEach((section, index) => expect([...section.childNodes]).toEqual(originalModalNodes[index]));
        scope.dispose();
        expect(host.innerHTML).toBe(originalContent);
        modalSections.forEach((section, index) => expect([...section.childNodes]).toEqual(originalModalNodes[index]));
        dom.window.close();
    });

    it.each([
        ["missing", domainModal + '<main><section><p>Unrelated content</p></section></main>' + imageModal, 0],
        ["ambiguous", domainModal + mainContent + mainContent + imageModal, 2],
    ])("leaves the entire page intact when the main host is %s", async (_, body, matches) => {
        const { dom, scope, adapter, onError, controller } = createPage(undefined, body);
        const originalNodes = [...dom.window.document.body.childNodes], originalHtml = dom.window.document.body.innerHTML;
        await expect(controller.start()).resolves.toBe(false);
        expect(adapter.mountFc2Detail).not.toHaveBeenCalled();
        expect(adapter.resolveMovieIdForRecord).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: `FC2 详情正文容器匹配异常：预期 1 个，实际 ${matches} 个` }));
        expect(dom.window.document.body.innerHTML).toBe(originalHtml);
        scope.dispose();
        expect([...dom.window.document.body.childNodes]).toEqual(originalNodes);
        dom.window.close();
    });

    it("does not take over the ordinary collection-codes page", async () => {
        const { dom, scope, adapter, onError, controller } = createPage("");
        const html = dom.window.document.body.innerHTML;
        await expect(controller.start()).resolves.toBe(false);
        expect(dom.window.document.body.innerHTML).toBe(html);
        expect(adapter.mountFc2Detail).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        scope.dispose(); dom.window.close();
    });

    it("renders loading errors in the main host and restores it on disposal", async () => {
        const { dom, scope, adapter, onError, controller } = createPage("?movieId=search&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123");
        const error = new Error("resolver unavailable");
        adapter.resolveMovieIdForRecord.mockRejectedValue(error);
        await expect(controller.start()).resolves.toBe(true);
        expect(dom.window.document.querySelector("body > section.section > .container .jhs-fc2-state")?.textContent).toBe("FC2 详情加载失败");
        expect(dom.window.document.querySelector("#domain-notice")?.textContent).toBe("Domain notice");
        expect(onError).toHaveBeenCalledExactlyOnceWith(error);
        scope.dispose();
        expect(dom.window.document.querySelector("#host-content")?.textContent).toBe("Original host content");
        dom.window.close();
    });

    it("ignores a resolution arriving after pagehide", async () => {
        const { dom, scope, adapter, controller } = createPage("?movieId=search&carNum=FC2-123&url=https%3A%2F%2Ffc2ppvdb.com%2Farticles%2F123");
        let resolveMovieId;
        adapter.resolveMovieIdForRecord.mockImplementation(() => new Promise(resolve => { resolveMovieId = resolve; }));
        const startup = controller.start();
        dom.window.dispatchEvent(new dom.window.Event("pagehide"));
        resolveMovieId("late-movie");
        await expect(startup).resolves.toBe(false);
        expect(adapter.mountFc2Detail).not.toHaveBeenCalled();
        expect(dom.window.document.querySelector("#host-content")?.textContent).toBe("Original host content");
        scope.dispose(); dom.window.close();
    });
});
