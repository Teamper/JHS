// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { JhsError } from "../../src/core/jhs-error.js";
import { LifecycleScope } from "../../src/core/lifecycle-scope.js";
import { createJavDbWebReview, parseJavDbWebReview } from "../../src/integrations/javdb/web-review.js";
import { JavDbWebReviewService } from "../../src/services/javdb-web-review-service.js";

const origin = "https://javdb.com";
const url = new URL("/v/fixture-id", origin);
const movie = { movieId: "fixture-id", carNum: "FC2-PPV-4995326" };
const fixtures = Object.fromEntries(["unmarked", "want-watch", "watched"].map(name =>
    [name.replace("-", "_"), readFileSync(new URL("../fixtures/integrations/javdb/fc2-web-review-" + name + ".html", import.meta.url), "utf8")]));
const parse = html => parseJavDbWebReview(new DOMParser().parseFromString(html, "text/html"), url, movie.carNum);

function setup({ initial = "unmarked", mutation = "accept", html } = {}) {
    let status = initial, fingerprint = "test-account-a";
    const writes = [];
    const request = vi.fn(async options => {
        if (options.method === "POST" || options.method === "DELETE") {
            writes.push(options);
            if (mutation !== "lost-without-write") {
                const body = new URLSearchParams(options.body);
                status = options.method === "DELETE" ? "unmarked" : options.url.endsWith("/want_to_watch") ? "want_watch" : body.get("video_review[status]") || "watched";
            }
            if (mutation === "switch-account") fingerprint = "test-account-b";
            if (mutation.startsWith("lost")) throw new JhsError("TIMEOUT", "lost response");
        }
        return { data: html?.(fixtures[status]) ?? fixtures[status], finalUrl: options.url, status: 200 };
    });
    const adapter = createJavDbWebReview({ request });
    const service = new JavDbWebReviewService({
        integrations: { getAdapter: () => adapter },
        lists: { currentContext: () => ({ origin }), access: async () => ({ origin, account: { fingerprint, label: "网页测试账号" } }) },
        locks: null,
    });
    return { adapter, request, service, writes, changeAccount: () => { fingerprint = "test-account-b"; }, scope: new LifecycleScope("fc2-web-review-test") };
}

describe("JavDB native FC2 review forms", () => {
    it("reads the captured states and prepares the verified create, edit and delete actions", () => {
        const unmarked = parse(fixtures.unmarked);
        expect(unmarked.status).toBe("unmarked");
        expect(unmarked.scoreRequired).toBe(false);
        expect(unmarked.actions.want.url.pathname).toBe("/v/fixture-id/reviews/want_to_watch");
        expect(Object.fromEntries(unmarked.actions.watch.fields)).toEqual({
            authenticity_token: "fixture-create-csrf", "video_review[status]": "", "video_review[content]": "",
        });
        const rated = fixtures.want_watch
            .replace('name="video_review[score]" value="4"', 'name="video_review[score]" value="4" checked')
            .replace('name="video_review[content]"></textarea>', 'name="video_review[content]">Existing review &amp; text</textarea>');
        const wanted = parse(rated);
        expect(wanted.status).toBe("want_watch");
        expect(Object.fromEntries(wanted.actions.watch.fields)).toEqual({
            _method: "put", authenticity_token: "fixture-edit-csrf", "video_review[status]": "watched",
            "video_review[score]": "4", "video_review[content]": "Existing review & text",
        });
        const watched = parse(fixtures.watched);
        expect(watched.status).toBe("watched");
        expect(watched.actions.unwatch).toMatchObject({ method: "DELETE", url: new URL("/v/fixture-id/reviews/100000001", origin), token: "fixture-page-csrf" });
    });

    it("rejects login pages or inconsistent full numbers and declines unverified delete links", () => {
        expect(() => parse('<form action="/login"></form>')).toThrow(expect.objectContaining({ code: "AUTH_REQUIRED" }));
        expect(() => parse(fixtures.unmarked.replace("FC2-4995326", "FC2-49953260"))).toThrow("番号与当前作品不一致");
        expect(() => parse(fixtures.unmarked.replace('action="/v/fixture-id/reviews"', 'action="https://other.example/v/fixture-id/reviews"'))).toThrow("无法核对");
        const ambiguous = fixtures.watched.replace('href="/v/fixture-id/reviews/100000001"', 'href="/v/other/reviews/100000001"');
        expect(parse(ambiguous)).toMatchObject({ status: "watched", actions: { want: expect.anything() } });
        expect(parse(ambiguous).actions.unwatch).toBeUndefined();
    });

    it("identifies a same-origin redirect to login with the native webpage transport", async () => {
        const request = vi.fn(async () => ({ data: "", finalUrl: origin + "/login", status: 200 }));
        await expect(createJavDbWebReview({ request }).readWebReview(origin, movie, new LifecycleScope("login"))).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
        expect(request).toHaveBeenCalledWith(expect.objectContaining({ transport: "native-fetch", nativeFallback: false, cacheScope: "none" }), expect.anything());
    });
});

describe("JavDB webpage account mutations", () => {
    it("checks the confirmed account, serializes duplicate clicks and reads back both states", async () => {
        const { service, scope, writes } = setup({ initial: "want_watch" });
        const expected = await service.read(movie, { scope });
        expect(expected.status).toBe("want_watch");
        const updates = await Promise.all([
            service.update(movie, { action: "watch", expected }, { scope }),
            service.update(movie, { action: "watch", expected }, { scope }),
        ]);
        expect(updates.map(offset => offset.outcome)).toEqual(["confirmed", "changed"]);
        expect(updates[0].state.status).toBe("watched");
        expect(writes).toHaveLength(1);
        expect(writes[0]).toMatchObject({
            method: "POST", retryCount: 0, transport: "native-fetch", nativeFallback: false,
            url: "https://javdb.com/v/fixture-id/reviews/100000001",
            headers: { "X-CSRF-Token": "fixture-edit-csrf" },
        });
        expect(new URLSearchParams(writes[0].body).get("video_review[status]")).toBe("watched");
        await expect(service.update(movie, { action: "unwatch", expected: updates[0].state }, { scope }))
            .resolves.toMatchObject({ outcome: "confirmed", state: { status: "unmarked" } });
        expect(writes[1]).toMatchObject({ method: "DELETE", headers: { "X-CSRF-Token": "fixture-page-csrf" } });
        expect(writes[1].body).toBeUndefined();
    });

    it("does not use a stale confirmation after a webpage account switch", async () => {
        const { service, scope, writes, changeAccount } = setup({ initial: "watched" });
        const expected = await service.read(movie, { scope });
        changeAccount();
        await expect(service.update(movie, { action: "unwatch", expected }, { scope })).resolves.toMatchObject({ outcome: "changed" });
        expect(writes).toHaveLength(0);
    });

    it.each([["lost-after-write", "confirmed"], ["lost-without-write", "pending"], ["switch-account", "pending"]])
    ("checks the result of %s before claiming success", async (mutation, outcome) => {
        const { service, scope, writes } = setup({ mutation });
        const expected = await service.read(movie, { scope });
        await expect(service.update(movie, { action: "watch", expected }, { scope })).resolves.toMatchObject({ outcome });
        expect(writes).toHaveLength(1);
    });

    it("asks for the verified form's required score before submitting", async () => {
        const { service, scope, writes } = setup({ html: source => source.replace('name="video_review[score]" value="5"', 'name="video_review[score]" value="5" required') });
        const expected = await service.read(movie, { scope });
        expect(expected.scoreRequired).toBe(true);
        await expect(service.update(movie, { action: "watch", expected }, { scope })).rejects.toThrow("要求先选择评分");
        expect(writes).toHaveLength(0);
        await expect(service.update(movie, { action: "watch", expected, score: 3 }, { scope })).resolves.toMatchObject({ outcome: "confirmed" });
        expect(new URLSearchParams(writes[0].body).get("video_review[score]")).toBe("3");
    });
});
