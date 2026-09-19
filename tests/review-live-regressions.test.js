import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import jquery from "jquery";
import { ReviewPanel } from "../src/ui/detail/review-panel.js";
import { SettingsService } from "../src/services/settings-service.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
let dom;
afterEach(() => { dom?.window.close(); vi.unstubAllGlobals(); });
async function harness() {
    dom = new JSDOM('<div id="target"></div>', { url: "https://javdb.com/v/a" });
    const $ = jquery(dom.window), values = new Map([["filter_keyword_review", ["blocked"]], ["setting", { enableLoadReview: "yes", reviewCount: 1 }]]);
    vi.stubGlobal("$", $); vi.stubGlobal("window", dom.window); vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("utils", { formatDate: String }); vi.stubGlobal("clog", { error() {} });
    const storage = { get: async key => values.get(key), set: async (key, value) => values.set(key, value), remove: async key => values.delete(key) };
    const settings = new SettingsService(storage); await settings.load();
    const scope = new LifecycleScope("reviews"), list = vi.fn(async () => [{ content: "blocked", createdAt: "today" }]);
    const panel = new ReviewPanel({ review: { list }, settings, storage, scope: async () => scope });
    return { $, settings, values, scope, list, panel };
}
describe("review settings regressions", () => {
    it("merges mistaken legacy keywords without losing the canonical list", async () => {
        const { values, panel } = await harness();
        values.set("review_filter_keyword", ["legacy", "blocked"]);
        expect(await panel.getKeywords()).toEqual(["blocked", "legacy"]);
        expect(values.has("review_filter_keyword")).toBe(false);
        await Promise.all([panel.saveKeyword("one"), panel.saveKeyword("two")]);
        expect(values.get("filter_keyword_review")).toEqual(["blocked", "legacy", "one", "two"]);
    });
    it("preserves legacy keywords when the canonical write fails", async () => {
        const { values, panel } = await harness();
        values.set("review_filter_keyword", ["legacy"]);
        panel.storage.set = async () => { throw new Error("write failed"); };
        await expect(panel.getKeywords()).rejects.toThrow("write failed");
        expect(values.get("review_filter_keyword")).toEqual(["legacy"]);
        expect(values.get("filter_keyword_review")).toEqual(["blocked"]);
    });
    it("ignores an old result after the panel is closed and reopened", async () => {
        const { $, settings, list, panel } = await harness();
        let finish;
        list.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const shown = panel.show("a", $("#target"));
        await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(1));
        await settings.set("enableLoadReview", "no");
        list.mockResolvedValue([{ content: "new-result", createdAt: "today" }]);
        await settings.set("enableLoadReview", "yes");
        await vi.waitFor(() => expect($(".review-content").text()).toBe("new-result"));
        finish([{ content: "old-result", createdAt: "today" }]);
        await shown;
        expect($(".review-content").text()).toBe("new-result");
    });
    it("reads canonical keywords and saves into the same portable key", async () => {
        const { $, values, panel } = await harness();
        await panel.show("a", $("#target"));
        expect($(".jhs-review-item")).toHaveLength(0);
        await panel.saveKeyword("another");
        expect(values.get("filter_keyword_review")).toEqual(["blocked", "another"]);
    });
    it("applies external settings changes and prevents hidden pagination requests", async () => {
        const { $, settings, scope, list, panel } = await harness();
        await panel.show("a", $("#target"));
        await settings.set("enableLoadReview", "no");
        expect($(".jhs-review-toggle").attr("aria-expanded")).toBe("false");
        $(".jhs-review-load-more").trigger("click");
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(list).toHaveBeenCalledTimes(1);
        scope.dispose();
        await settings.set("enableLoadReview", "yes");
        expect(list).toHaveBeenCalledTimes(1);
    });
});
