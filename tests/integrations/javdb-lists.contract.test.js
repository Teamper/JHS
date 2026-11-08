// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createJavDbAdapter } from "../../src/integrations/javdb/manifest.js";
import { parseJavDbListPage, parseJavDbWebAccount } from "../../src/integrations/javdb/web-lists.js";

const origin = "https://javdb.com";
const rows = readFileSync(join(import.meta.dirname, "../fixtures/integrations/javdb/web-lists.html"), "utf8");
const account = readFileSync(join(import.meta.dirname, "../fixtures/integrations/javdb/web-account.html"), "utf8");

describe("JavDB webpage list protocol", () => {
    it("reads names, counts, membership and disabled rows as text", () => {
        const result = parseJavDbListPage({ lists: rows, page: '<a rel="next" href="/users/simple_lists?page=2">下一页</a>' }, `${origin}/users/simple_lists?vid=video-1`, "video-1");
        expect(result.lists).toEqual([
            { id: "list-1", name: "稍后观看", count: 12, checked: true, disabled: false },
            { id: "list-2", name: "私人 <清单>", count: 3, checked: false, disabled: false },
            { id: "locked", name: "预设清单", count: 0, checked: false, disabled: true },
        ]);
        expect(new URL(result.nextUrl).searchParams.get("vid")).toBe("video-1");
        expect(parseJavDbListPage({ lists: "", page: "" }, `${origin}/users/simple_lists`, null)).toEqual({ lists: [], nextUrl: null });
    });

    it.each(["https://foreign.example/users/simple_lists?page=2", "/users/save_video_to_list", "/users/simple_lists?vid=other", "/users/simple_lists#fragment"])("rejects an unbound next page %s", href => {
        expect(() => parseJavDbListPage({ lists: rows, page: `<a rel="next" href="${href}">next</a>` }, `${origin}/users/simple_lists?vid=video-1`, "video-1")).toThrow();
    });

    it.each([{ lists: "<form action='/login'>登录</form>" }, { lists: "<h1>访问失败</h1>" }, { lists: [] }, { lists: rows, page: 1 }, { lists: '<label><input type="checkbox" data-list-id="bad/id">invalid</label>' }])("rejects incomplete or malformed payload %j", payload => {
        expect(() => parseJavDbListPage(payload, `${origin}/users/simple_lists`, null)).toThrow();
    });

    it("derives an account only from an authenticated self-edit form or an explicit current user marker", () => {
        expect(parseJavDbWebAccount(account, origin)).toEqual({ identity: "id:fixture-user-17", label: "网页账号 fixture-user-17", csrf: "fixture-csrf-token" });
        const emailOnly = account.replace('<input type="hidden" name="user[id]" value="fixture-user-17">', "");
        expect(parseJavDbWebAccount(emailOnly, origin)).toMatchObject({ identity: "email:fixture@example.test", label: "f***@example.test" });
        expect(parseJavDbWebAccount('<meta name="csrf-token" content="fixture"><meta name="current-user-id" content="user-1">', origin)).toMatchObject({ identity: "id:user-1" });
    });

    it.each([
        '<meta name="csrf-token" content="fixture"><div data-user-id="viewed-profile">nickname</div>',
        '<meta name="csrf-token" content="fixture"><meta name="current-user-id" content="a"><div data-current-user-id="b"></div>',
        '<meta name="csrf-token" content="fixture"><meta name="current-user-id" content="a"><nav id="navbar-menu-user"><a href="/login">登录</a></nav>',
        '<form action="/users" method="post"><input name="user[email]" value="f@example.test"></form>',
    ])("keeps ambiguous, anonymous or unproven account HTML read-only", html => {
        expect(parseJavDbWebAccount(html, origin)).toBeNull();
    });

    it("uses native same-origin requests, pins every target and disables retries and transport fallback", async () => {
        const request = vi.fn(async options => ({ data: options.responseType === "text" ? account : options.method === "POST" ? { success: true } : { lists: rows } }));
        const adapter = createJavDbAdapter({ request });
        await adapter.readWebAccount(origin, `${origin}/users/edit`);
        await adapter.readListPage(origin, "video-1");
        await expect(adapter.setListMember(origin, { videoId: "video-1", listId: "list-1", checked: true, csrf: "fixture-csrf-token" })).resolves.toBe("accepted");
        for (const [options] of request.mock.calls) expect(options).toMatchObject({ transport: "native-fetch", nativeFallback: false, retryCount: 0, requestOptions: { redirect: "error", cache: "no-store" }, urlPolicy: { expectedOrigin: origin, expectedUrl: options.url } });
        expect(JSON.parse(request.mock.calls[2][0].body)).toEqual({ video_id: "video-1", list_id: "list-1", checked: true });
        expect(request.mock.calls[2][0].headers["X-CSRF-Token"]).toBe("fixture-csrf-token");
        expect(request.mock.calls[2][0].circuitGroup).toBe("account-mutation");
        expect(request.mock.calls[2][0].url).not.toContain("csrf");
        await expect(adapter.readWebAccount(origin, "https://foreign.example/users/edit")).rejects.toThrow();
        expect(request).toHaveBeenCalledTimes(3);
    });
});
