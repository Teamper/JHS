// @vitest-environment jsdom
import jquery from "jquery";
import { beforeEach, describe, expect, it } from "vitest";
import { renderFc2Gallery } from "../src/ui/detail/fc2-workspace-view.js";

beforeEach(() => {
    globalThis.$ = jquery;
    document.body.innerHTML = "";
});

function makeContext() {
    const root = jquery('<div class="jhs-fc2-workspace"></div>').append(
        '<div data-jhs-role="gallery-grid"></div><div data-jhs-role="main-preview"></div><div data-jhs-role="screenshot"></div>'
    ).appendTo(document.body);
    return { root, carNum: "FC2-123", galleryUrls: undefined };
}

describe("FC2 gallery dedup insurance", () => {
    it("records gallery urls on the context", () => {
        const context = makeContext();
        renderFc2Gallery(context, [ "https://fc2content.net/a/1.jpg", "https://fc2content.net/a/2.jpg" ], "https://covers.example/cover.jpg");
        expect([ ...context.galleryUrls ]).toEqual([ "https://fc2content.net/a/1.jpg", "https://fc2content.net/a/2.jpg" ]);
        expect(context.root.find('[data-jhs-role="main-preview"] img').attr("src")).toBe("https://covers.example/cover.jpg");
    });

    it("keeps the overview cover separate from the first gallery image", () => {
        const context = makeContext();
        renderFc2Gallery(context, [ "https://fc2content.net/a/1.jpg", "https://fc2content.net/a/2.jpg" ]);
        expect(context.root.find('[data-jhs-role="main-preview"] img').length).toBe(0);
        expect(context.root.find('[data-jhs-role="gallery-grid"] img').first().attr("src")).toBe("https://fc2content.net/a/1.jpg");
    });

    it("records an empty gallery so a later duplicate check cannot match", () => {
        const context = makeContext();
        renderFc2Gallery(context, []);
        expect(context.galleryUrls.size).toBe(0);
        expect(context.root.find('[data-jhs-role="gallery-grid"]').text()).toBe("暂无剧照");
    });

    it("hides an extra screenshot whose url duplicates a gallery image", () => {
        const context = makeContext();
        const shot = context.root.find('[data-jhs-role="screenshot"]');
        shot.append(jquery('<img src="https://fc2content.net/a/1.jpg">'));
        renderFc2Gallery(context, [ "https://fc2content.net/a/1.jpg", "https://fc2content.net/a/2.jpg" ]);
        expect(shot.children().length).toBe(0);
    });

    it("keeps an extra screenshot that is not in the gallery", () => {
        const context = makeContext();
        const shot = context.root.find('[data-jhs-role="screenshot"]');
        shot.append(jquery('<img src="https://javstore.net/long.jpg">'));
        renderFc2Gallery(context, [ "https://fc2content.net/a/1.jpg" ]);
        expect(shot.children().length).toBe(1);
    });
});
