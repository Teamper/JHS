import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const movies = [
    { code: "MSFH-021", name: "msfh", count: 3, image: "https://img.javstore.net/images/2025/12/04/MOSAIC-ARCHIVE-msfh-021_s.jpg" },
    { code: "TENN-052", name: "tenn", count: 1, image: "https://img2.javstore.net/images/2026/09/12/TENN-052.1080p_s.jpg" },
    { code: "GANA-3471", name: "gana", count: 1, detail: "gana-detail.html", image: "https://img2.javstore.net/images/2026/11/24/200GANA-3471_s.jpg" },
];

async function boot(page, context, movie, project, failure = null) {
    await fulfillHostFixtures(context);
    const html = (await readFile(new URL("../fixtures/javdb-detail-native-media.html", import.meta.url), "utf8")).replaceAll("ABC-123", movie.code);
    const search = await readFile(new URL(`../../fixtures/integrations/javstore/${movie.name}-search.html`, import.meta.url), "utf8");
    const details = await Promise.all(Array.from({ length: movie.count }, (_value, i) => readFile(new URL(`../../fixtures/integrations/javstore/${movie.detail || `${movie.name}-detail-${i + 1}.html`}`, import.meta.url), "utf8")));
    await context.route("https://javdb.com/v/**", route => route.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
    const sheet = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1800"><rect width="900" height="1800" fill="#466b86"/><rect x="30" y="30" width="840" height="120" fill="#acc8da"/></svg>';
    await context.route("https://images.example.test/**", route => route.fulfill({ contentType: "image/svg+xml", body: sheet }));
    await context.route(movie.image, route => route.fulfill({ contentType: "image/svg+xml", body: sheet }));
    await page.goto("https://javdb.com/v/structured-screenshot");
    await injectUserscriptRuntime(page, {
        hostStyles: true, realFeedback: true,
        settingOverrides: { themeMode: project === "mobile" ? "dark" : "light", enableLoadScreenShot: "yes", enableLoadPreviewVideo: "no", enableLoadReview: "no", enableLoadRelatedList: "no", enableLoadOtherSite: "no", needClosePage: "no" },
        beforeUserscriptInjection: host => host.evaluate(({ search, details, failure }) => {
            const original = window.GM_xmlhttpRequest;
            const doc = new DOMParser().parseFromString(search, "text/html");
            const candidates = [...doc.querySelectorAll("main .grid a")].map(a => new URL(a.getAttribute("href"), "https://javstore.net").pathname);
            window.javstoreRequests = [];
            window.javstoreRecovered = false;
            window.GM_xmlhttpRequest = options => {
                const url = new URL(options.url);
                if (url.hostname !== "javstore.net") return original(options);
                window.javstoreRequests.push(url.pathname);
                let body;
                if (url.pathname === "/search") {
                    body = search;
                    if (failure && !window.javstoreRecovered) body = failure === "identity" ? '<main><div class="grid"><a href="/MSFH021-pn.html"><h3>MSFH-022</h3></a></div></main>' : '<main><h1>Search: MSFH-021</h1><div>Changed layout</div></main>';
                } else body = details[candidates.indexOf(url.pathname)] || "<main></main>";
                const timer = setTimeout(() => options.onload?.({ status: 200, response: body, responseText: body, finalUrl: url.href, responseHeaders: "content-type: text/html; charset=utf-8" }), 50);
                return { abort() { clearTimeout(timer); options.onabort?.(); } };
            };
        }, { search, details, failure }),
    });
    return page.locator(".screen-container");
}

for (const movie of movies) test(`${movie.code} loads the verified sheet through ordered candidates`, async ({ page, context }, info) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const tile = await boot(page, context, movie, info.project.name);
    await expect(tile.locator("img")).toHaveAttribute("src", movie.image);
    await expect.poll(() => tile.locator("img").evaluate(img => img.naturalHeight)).toBe(1800);
    expect(await page.evaluate(() => window.javstoreRequests.length)).toBe(movie.count + 1);
    await tile.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("resolved-sheet.png"), animations: "disabled" });
    const trigger = tile.getByRole("button", { name: "查看缩略图", exact: true });
    await trigger.click();
    await expect(page.locator(".viewer-canvas img")).toHaveAttribute("src", movie.image);
    await expect(page.locator(".viewer-container")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    expect(errors).toEqual([]);
});

for (const [reason, label] of [["identity", "番号核验未通过"], ["structure", "页面格式暂不支持"]]) test(`JavStore ${reason} failure offers a fresh retry`, async ({ page, context }, info) => {
    const tile = await boot(page, context, movies[0], info.project.name, reason);
    await expect(tile).toContainText(label);
    await expect(tile).not.toContainText("暂无缩略图");
    await tile.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`${reason}-failure.png`), animations: "disabled" });
    const retry = tile.getByRole("button", { name: "重试", exact: true });
    await retry.focus();
    await page.evaluate(() => { window.javstoreRecovered = true; });
    await page.keyboard.press("Enter");
    await expect(tile.locator("img")).toHaveAttribute("src", movies[0].image);
    await expect.poll(() => tile.locator("img").evaluate(img => img.naturalHeight)).toBe(1800);
    await expect(tile.getByRole("button", { name: "查看缩略图", exact: true })).toBeFocused();
    expect(await page.evaluate(() => window.javstoreRequests.length)).toBe(6);
});

for (const surface of ["detail", "list"]) test(`first-open ${surface} displays one usable candidate after a broken confirmed image`, async ({ page, context }, info) => {
    test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop and mobile candidate display");
    await fulfillHostFixtures(context);
    const title = "探索用プレビュー", code = "ABC-170";
    const detail = surface === "detail";
    const hostFixture = detail ? "javdb-detail-native-media.html" : "javdb-list.html";
    const host = (await readFile(new URL(`../fixtures/${hostFixture}`, import.meta.url), "utf8"))
        .replaceAll("ABC-123", code).replaceAll(detail ? "Browser Fixture" : "JavDB Fixture Movie", title)
        .replace('class="tags" style="display:none"', 'class="tags"');
    const [searchHtml, candidateHtml] = await Promise.all(["first-open-search.html", "first-open-detail.html"].map(file =>
        readFile(new URL(`../../fixtures/integrations/javstore/${file}`, import.meta.url), "utf8")));
    const hostUrl = detail ? "https://javdb.com/v/first-open" : "https://javdb.com/";
    const candidateUrl = "https://img.javstore.net/XYZ-987_s.jpg", brokenUrl = "https://img.javstore.net/ABC-170-missing.jpg";
    const exactPath = `/702-ABC-170-${title}-pn.html`, candidatePath = `/703-XYZ-987-${title}-pn.html`;
    const sheet = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1800"><rect width="900" height="1800" fill="#405d75"/><rect x="30" y="30" width="840" height="120" fill="#acc8da"/></svg>';
    await context.route(hostUrl, route => route.fulfill({ contentType: "text/html; charset=utf-8", body: host }));
    await context.route("https://images.example.test/**", route => route.fulfill({ contentType: "image/svg+xml", body: sheet }));
    await context.route(candidateUrl, route => route.fulfill({ contentType: "image/svg+xml", body: sheet }));
    const attempted = [];
    await context.route(brokenUrl, route => { attempted.push(route.request().url()); return route.fulfill({ status: 404 }); });
    await page.goto(hostUrl);
    await injectUserscriptRuntime(page, {
        hostStyles: true, realFeedback: true,
        settingOverrides: { enableScreenSvg: "yes", enableLoadScreenShot: "yes", enableLoadPreviewVideo: "no", enableLoadReview: "no", enableLoadRelatedList: "no", enableLoadOtherSite: "no", defaultQuickFilterTab: "all" },
        beforeUserscriptInjection: (hostPage) => hostPage.evaluate(({ title, code, searchHtml, candidateHtml, exactPath, candidatePath, brokenUrl }) => {
            const original = window.GM_xmlhttpRequest;
            window.firstOpenReads = [];
            window.GM_xmlhttpRequest = (options) => {
                const url = new URL(options.url);
                if (url.hostname !== "javstore.net") return original(options);
                const query = url.searchParams.get("q"), path = decodeURIComponent(url.pathname);
                window.firstOpenReads.push(query || path);
                let body = "<main></main>";
                if (query === code) body = `<main><div class="grid"><a href="${exactPath}"><h3>${code} ${title}</h3></a></div></main>`;
                if (query === title) body = searchHtml;
                if (path === exactPath) body = `<main><article><h1>${code} ${title}</h1><a href="${brokenUrl}">CLICK HERE!</a></article></main>`;
                if (path === candidatePath) body = candidateHtml;
                const timer = setTimeout(() => options.onload?.({ status: 200, response: body, responseText: body, finalUrl: options.url }), 20);
                return { abort() { clearTimeout(timer); options.onabort?.(); } };
            };
        }, { title, code, searchHtml, candidateHtml, exactPath, candidatePath, brokenUrl }),
    });

    const trigger = detail
        ? page.locator(".screen-container").getByRole("button", { name: "查看候选长图", exact: true })
        : page.locator(".movie-list .item").filter({ hasText: code }).getByRole("button", { name: "长缩略图", exact: true });
    if (detail) {
        const panel = page.locator(".screen-container");
        await expect(panel).toContainText("候选长图 · JavStore");
        await expect(panel.locator("img")).toHaveCount(1);
        await expect(panel.locator("img")).toHaveAttribute("src", candidateUrl);
        await panel.screenshot({ path: info.outputPath("candidate-detail.png"), animations: "disabled" });
    }
    await trigger.click();
    const viewer = page.locator(".jhs-image-viewer");
    await expect(viewer.locator(".jhs-image-viewer-toolbar")).toContainText("候选长图");
    await expect(viewer.locator(".viewer-canvas img")).toHaveAttribute("src", candidateUrl);
    await expect.poll(() => viewer.locator(".viewer-canvas img").evaluate(img => img.naturalHeight)).toBe(1800);
    expect(attempted).toEqual([brokenUrl]);
    expect(await page.evaluate(() => window.firstOpenReads)).toEqual([code, exactPath, title, candidatePath]);
    if (!detail) await page.screenshot({ path: info.outputPath("candidate-list.png"), animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
});
