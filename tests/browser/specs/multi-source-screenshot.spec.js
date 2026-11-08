import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const fixtures = {};
for (const source of ["projectjav", "javfree"]) {
    fixtures[source] = {};
    for (const kind of ["search", "detail"]) fixtures[source][kind] = await readFile(new URL(`../../fixtures/integrations/${source}/${kind}.html`, import.meta.url), "utf8");
}
const image = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="1600"><rect width="600" height="1600" fill="#466b86"/></svg>';

for (const theme of ["light", "dark"]) for (const mode of ["auto", "manual"]) {
    test(`multiple screenshot sources ${mode} ${theme}`, async ({ page, context }, info) => {
        await fulfillHostFixtures(context);
        const html = (await readFile(new URL("../fixtures/javdb-detail-native-media.html", import.meta.url), "utf8")).replaceAll("ABC-123", "SSIS-001");
        await context.route("https://javdb.com/v/**", route => route.fulfill({ contentType: "text/html", body: html }));
        await context.route("https://images.projectjav.com/**", route => route.fulfill({ contentType: "image/svg+xml", body: image }));
        await context.route("https://cf.javfree.me/**", route => route.fulfill({ contentType: "image/svg+xml", body: image }));
        await page.goto("https://javdb.com/v/screenshot-sources");
        await injectUserscriptRuntime(page, {
            hostStyles: true, realFeedback: true,
            settingOverrides: { themeMode: theme, screenshotMode: mode, screenshotProviders: [{ id: "javstore", enabled: true }, { id: "projectjav", enabled: true }, { id: "javfree", enabled: true }], enableLoadScreenShot: "yes", enableLoadPreviewVideo: "no", enableLoadReview: "no", enableLoadOtherSite: "no", enableLoadRelatedList: "no" },
            beforeUserscriptInjection: host => host.evaluate(fixtures => {
                const original = window.GM_xmlhttpRequest;
                window.screenshotCalls = [];
                window.GM_xmlhttpRequest = options => {
                    const url = new URL(options.url), source = url.hostname === "projectjav.com" ? "projectjav" : url.hostname === "javfree.me" ? "javfree" : url.hostname === "javstore.net" ? "javstore" : null;
                    if (!source) return original(options);
                    window.screenshotCalls.push(source);
                    const body = source === "javstore" ? "<main></main>" : fixtures[source][url.pathname === "/" || url.pathname.startsWith("/search/") ? "search" : "detail"];
                    let aborted = false;
                    queueMicrotask(() => { if (!aborted) options.onload?.({ status: 200, response: body, responseText: body, finalUrl: url.href, responseHeaders: "content-type: text/html" }); });
                    return { abort() { aborted = true; options.onabort?.(); } };
                };
            }, fixtures),
        });
        const tile = page.locator(".screen-container");
        if (mode === "manual") {
            await expect(tile.getByRole("tab", { name: "JavFree", exact: true })).toBeVisible();
            expect(await page.evaluate(() => window.screenshotCalls)).toEqual([]);
            await tile.getByRole("tab", { name: "JavFree", exact: true }).click();
            await expect(tile.locator("img")).toHaveAttribute("src", "https://cf.javfree.me/HLIC/SSIS-001-demosaic.jpeg");
            await expect(tile).toContainText("来源 JavFree");
            expect(await page.evaluate(() => window.screenshotCalls)).toEqual(["javfree", "javfree"]);
        } else {
            await expect(tile.locator("img")).toHaveAttribute("src", "https://images.projectjav.com/data/screenshots/79945.jpg");
            await expect(tile).toContainText("来源 ProjectJav");
            expect(await page.evaluate(() => window.screenshotCalls)).toEqual(["javstore", "projectjav", "projectjav"]);
        }
        await expect.poll(() => tile.locator("img").evaluate(node => node.naturalHeight)).toBe(1600);
        expect(await tile.evaluate(node => {
            const source = node.querySelector(".jhs-screenshot-source"), rect = source.getBoundingClientRect(), outer = node.getBoundingClientRect();
            return { visible: rect.height > 0 && rect.top >= outer.top && rect.bottom <= outer.bottom, maxHeight: getComputedStyle(node).maxHeight, height: outer.height, sourceBottom: rect.bottom - outer.top };
        })).toMatchObject({ visible: true });
        await tile.screenshot({ path: info.outputPath("screenshot-sources.png") });
    });
}
