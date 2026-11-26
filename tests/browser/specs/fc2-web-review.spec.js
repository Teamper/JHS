import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { injectRealLayer } from "../harness/real-layer.js";

const origin = "https://javdb.com";
const loginPage = '<form action="/login"></form>';
const owned = origin + "/users/collection_codes?movieId=fixture-id&carNum=FC2-4995326&url=https%3A%2F%2Fjavdb.com%2Fv%2Ffixture-id&source=fc2";
const file = (name) => new URL("../../fixtures/integrations/javdb/" + name + ".html", import.meta.url);

async function mount(context, page, { entry, loggedIn, loseWrite = false }) {
    const [account, unmarked, wanted, watched] = await Promise.all(["web-account", "fc2-web-review-unmarked", "fc2-web-review-want-watch", "fc2-web-review-watched"].map(name => readFile(file(name), "utf8")));
    const templates = {
        unmarked,
        want_watch: wanted.replace('name="video_review[score]" value="5"', 'name="video_review[score]" value="5" required'),
        watched: watched.replace('name="video_review[score]" value="4"', 'name="video_review[score]" value="4" checked')
            .replace('name="video_review[content]"></textarea>', 'name="video_review[content]">Existing short review</textarea>'),
    };
    let state = "unmarked";
    const writes = [];
    await fulfillHostFixtures(context);
    await context.route(origin + "/login", route => route.fulfill({ contentType: "text/html", body: loginPage }));
    await context.route(origin + "/users/edit", route => route.fulfill({ contentType: "text/html", body: loggedIn ? account : loginPage }));
    // Serve the login document here to keep the redirect target off the real network.
    await context.route(origin + "/v/fixture-id", route => route.fulfill({ contentType: "text/html", body: loggedIn ? templates[state] : loginPage }));
    await context.route(origin + "/v/fixture-id/reviews**", async route => {
        const req = route.request(), pathname = new URL(req.url()).pathname;
        writes.push({ method: req.method(), pathname, body: new URLSearchParams(req.postData()) });
        if (loseWrite) return route.abort("timedout");
        if (req.method() === "DELETE") state = "unmarked";
        else if (pathname.endsWith("/want_to_watch")) state = "want_watch";
        else state = "watched";
        await route.fulfill({ contentType: "text/javascript", body: "/* fixture accepted */" });
    });
    await page.goto(entry === "card" ? origin + "/tags/fc2" : owned, { waitUntil: "domcontentloaded" });
    await injectUserscriptRuntime(page, {
        hostStyles: true, realFeedback: true,
        settingOverrides: { needClosePage: "no", enableLoadReview: "no", enableLoadRelated: "no", enableLoadOtherSite: "no", enableLoadScreenShot: "no" },
        beforeUserscriptInjection: async host => {
            await injectRealLayer(host);
            await host.evaluate(entry => {
                const nav = document.querySelector("#navbar-menu-user") || document.body.appendChild(document.createElement("nav"));
                nav.id = "navbar-menu-user";
                const link = nav.appendChild(document.createElement("a"));
                link.href = "/users/edit";
                link.textContent = "账号设置";
                if (entry === "card") {
                    const card = document.querySelector(".movie-list .item");
                    card.querySelector("a").href = "/v/fixture-id";
                    card.querySelector(".video-title strong").textContent = "FC2-4995326";
                }
            }, entry);
        },
    });
    if (entry === "card") await page.locator('.movie-list .item a[data-jhs-fc2-primary="true"]').first().click();
    return { writes, signIn: () => { loggedIn = true; } };
}

for (const entry of ["card", "owned"]) {
    test("native FC2 " + entry + " uses one web account for want and watched", async ({ context, page }, info) => {
        test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop and touch workspace coverage");
        const { writes, signIn } = await mount(context, page, { entry, loggedIn: entry === "owned" });
        const want = page.locator('[data-jhs-action="javdb-want"]');
        const watched = page.locator('[data-jhs-action="javdb-watched"]');
        const local = page.locator("#hasWatchBtn");
        if (entry === "card") {
            await expect(page.getByRole("link", { name: "登录 JavDB 网页" })).toHaveAttribute("href", origin + "/login");
            expect(writes).toHaveLength(0);
            signIn();
            await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        }
        await expect(want).toBeEnabled();
        await expect(watched).toHaveAttribute("aria-pressed", "false");
        await want.click();
        await expect(want).toHaveAttribute("aria-pressed", "true");
        await watched.click();
        const ratingDialog = page.locator(".layui-layer").filter({ hasText: "标记 JavDB 看过" });
        const score = ratingDialog.getByRole("combobox", { name: "评分" });
        await expect(score).toBeVisible();
        await ratingDialog.locator(".layui-layer-btn1").click();
        expect(writes).toHaveLength(1);
        await score.click();
        await page.getByRole("option", { name: "4 分", exact: true }).click();
        await ratingDialog.locator(".layui-layer-btn1").click();
        await expect(watched).toHaveAttribute("aria-pressed", "true");
        await expect(want).toHaveAttribute("aria-pressed", "false");
        await expect(local).toHaveAttribute("aria-pressed", "false");
        if (info.project.name === "mobile") {
            await watched.focus();
            await expect(page.getByRole("tooltip")).toHaveCSS("pointer-events", "none");
        }
        await local.click();
        await expect(local).toHaveAttribute("aria-pressed", "true");
        await watched.click();
        const removal = page.locator(".layui-layer-dialog").filter({ hasText: "取消 JavDB 看过会删除这条评价中的评分（4 分）和短评" });
        await expect(removal).toBeVisible();
        await removal.locator(".layui-layer-btn0").click();
        await expect(removal).toHaveCount(0);
        expect(writes).toHaveLength(2);
        await watched.click();
        await removal.locator(".layui-layer-btn1").click();
        await expect(watched).toHaveAttribute("aria-pressed", "false");
        await expect(local).toHaveAttribute("aria-pressed", "true");
        expect(writes.map(({ method, pathname }) => [method, pathname])).toEqual([
            ["POST", "/v/fixture-id/reviews/want_to_watch"],
            ["POST", "/v/fixture-id/reviews/100000001"],
            ["DELETE", "/v/fixture-id/reviews/100000001"],
        ]);
        expect(writes[1].body.get("_method")).toBe("put");
        expect(writes[1].body.get("video_review[score]")).toBe("4");
    });
}

test("FC2 review timeout requires refresh before another write", async ({ context, page }, info) => {
    test.skip(info.project.name !== "desktop-wide", "one project covers the unresolved write");
    const { writes } = await mount(context, page, { entry: "owned", loggedIn: true, loseWrite: true });
    const watched = page.locator('[data-jhs-action="javdb-watched"]');
    await watched.click();
    const refresh = page.getByRole("button", { name: "JavDB 待确认，刷新状态" });
    await expect(refresh).toBeEnabled();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(refresh).toBeVisible();
    expect(writes).toHaveLength(1);
    expect(writes[0].body.has("video_review[score]")).toBe(false);
    await refresh.click();
    await expect(watched).toBeEnabled();
    expect(writes).toHaveLength(1);
});
