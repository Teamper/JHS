import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { injectRealLayer } from "../harness/real-layer.js";

const ownedUrl = "https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-4995326&url=https%3A%2F%2Fjavdb.com%2Fv%2Ffixture-id&source=fc2";

for (const entry of ["owned", "card"]) {
    test(`FC2 ${entry} detail keeps card metadata and reloads after login`, async ({ page, context }, info) => {
        const search = await readFile(new URL("../../fixtures/integrations/javstore/search-fc2-4995326.html", import.meta.url), "utf8");
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await fulfillHostFixtures(context);
        const image = route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#60758c"/><text x="30" y="210" fill="white" font-size="28">FC2 media fixture</text></svg>' });
        await context.route("https://images.example.test/**", image);
        await context.route("https://img2.javstore.net/**", image);
        await page.goto(entry === "card" ? "https://javdb.com/tags/fc2" : ownedUrl);
        await injectUserscriptRuntime(page, {
            hostStyles: true, realFeedback: true,
            settingOverrides: { themeMode: info.project.name === "mobile" ? "dark" : "light", enableLoadReview: "no", enableLoadRelated: "no", enableLoadOtherSite: "no", enableLoadScreenShot: "yes", translateTitle: "no" },
            beforeUserscriptInjection: async host => {
                await injectRealLayer(host);
                await host.evaluate(({ search, entry }) => {
                    if (entry === "card") {
                        const card = document.querySelector(".movie-list .item");
                        card.querySelector("a").setAttribute("href", "/v/fixture-id");
                        card.querySelector("a").setAttribute("title", "Card title before opening");
                        card.querySelector(".video-title strong").textContent = "FC2-4995326";
                        card.querySelector("img").src = "https://images.example.test/card.svg";
                    }
                    window.fc2DetailRequests = [];
                    window.fc2ScreenshotQueries = [];
                    const original = window.GM_xmlhttpRequest;
                    window.GM_xmlhttpRequest = options => {
                        const url = new URL(options.url);
                        let data;
                        if (url.hostname === "javstore.net") {
                            if (url.pathname === "/search") window.fc2ScreenshotQueries.push(url.searchParams.get("q"));
                            data = url.pathname === "/search" ? search : '<main><img src="https://img2.javstore.net/fc2ppv-4995326_s.jpg" alt="FC2PPV-4995326"></main>';
                        } else if (url.pathname === "/api/v1/sessions") {
                            data = { success: 1, data: { token: "fixture-login-token" } };
                        } else if (url.pathname === "/api/v1/movies/fixture-id/magnets") {
                            data = { success: 1, data: { magnets: [] } };
                        } else if (url.pathname === "/api/v2/users/review_movies") {
                            data = { success: 1, data: { movies: [] } };
                        } else if (url.pathname === "/api/v4/movies/fixture-id") {
                            const authenticated = options.headers.authorization === "Bearer fixture-login-token";
                            window.fc2DetailRequests.push(authenticated);
                            data = authenticated ? { success: 1, data: { movie: { id: "fixture-id", number: "FC2-4995326", title: "FC2 Fixture title", origin_title: "FC2 Original title", cover_url: "https://images.example.test/cover.svg", preview_images: [{ large_url: "https://images.example.test/gallery.svg" }], actors: [], duration: 20 } } } : { success: 0, message: "請登錄帳號", data: null };
                        } else return original(options);
                        const deliver = () => options.onload({ status: 200, response: data, responseText: typeof data === "string" ? data : JSON.stringify(data), finalUrl: url.href, responseHeaders: typeof data === "string" ? "content-type: text/html" : "content-type: application/json" });
                        if (entry === "card" && url.pathname === "/api/v4/movies/fixture-id" && !options.headers.authorization) window.releaseFc2Detail = deliver;
                        else queueMicrotask(deliver);
                        return { abort() {} };
                    };
                }, { search, entry });
            },
        });
        if (entry === "card") await page.locator('.movie-list a[data-jhs-fc2-primary="true"]').click();
        const summary = page.locator('[data-jhs-role="summary-content"]');
        if (entry === "card") {
            await page.waitForFunction(() => typeof window.releaseFc2Detail === "function");
            await expect(summary).toContainText("Card title before opening");
            await expect(summary).toContainText("加载中");
            await expect(page.locator('[data-jhs-role="main-preview"] img')).toHaveAttribute("src", "https://images.example.test/card.svg");
            await page.evaluate(() => window.releaseFc2Detail());
        }
        await expect(summary).toContainText("影片信息需要登录");
        const login = summary.getByRole("button", { name: "登录 JavDB", exact: true });
        await expect(login).toBeVisible();
        if (entry === "card") {
            await expect(summary).toContainText("Card title before opening");
            await expect(page.locator('[data-jhs-role="main-preview"] img')).toHaveAttribute("src", "https://images.example.test/card.svg");
            expect(await page.locator('[data-jhs-role="main-preview"] img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
        }
        await expect(page.locator('[data-jhs-role="screenshot"] img')).toHaveAttribute("src", "https://img2.javstore.net/fc2ppv-4995326_s.jpg");
        await page.waitForFunction(() => [...document.querySelectorAll(".layui-layer")].every(layer => layer.getAnimations().every(animation => animation.playState !== "running")));
        await page.screenshot({ path: info.outputPath("fc2-login-required.png") });
        await login.click();
        await page.locator(".layui-layer #username").fill("fixture-user");
        await page.locator(".layui-layer #password").fill("fixture-password");
        await page.locator(".layui-layer #loginBtn").click();
        await expect(summary).toContainText("FC2 Fixture title");
        await expect(page.locator(".layui-layer #loginBtn")).toHaveCount(0);
        await expect(summary.getByRole("button", { name: "登录 JavDB", exact: true })).toHaveCount(0);
        await expect(page.locator('[data-jhs-role="main-preview"] img')).toHaveAttribute("src", "https://images.example.test/cover.svg");
        expect(await page.evaluate(() => window.fc2DetailRequests)).toEqual([false, true]);
        expect(await page.evaluate(() => window.fc2ScreenshotQueries)).toEqual(["FC2-PPV-4995326"]);
        expect(await page.evaluate(() => JSON.stringify(window.GM_getValue("jhs_appAuthorization")))).not.toContain("fixture-login-token");
        await page.locator(".jhs-fc2-workspace").evaluate(root => { root.scrollTop = 0; });
        await page.screenshot({ path: info.outputPath("fc2-login-restored.png") });
        expect(errors).toEqual([]);
    });

}
