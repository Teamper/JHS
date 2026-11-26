import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
const fixture = await readFile(new URL("../fixtures/javdb-home-multiple-lists.html", import.meta.url), "utf8");

test("outer pagination auto-loads main results and reattaches the jump control", async ({ context, page }, info) => {
    test.skip(info.project.name !== "desktop-wide", "desktop pagination fixture");
    const listUrl = "https://javdb.com/?t=d&c10=1";
    const first = fixture.replace(/(<nav class="pagination">.*?<\/nav>)<\/div>/s, "</div>$1")
        .replace('href="?page=2"', 'href="?t=d&amp;c10=1&amp;page=2"');
    const second = first.replaceAll("ABC-001", "ABC-003").replaceAll("ABC-002", "ABC-004")
        .replace(/<a class="pagination-next"[^>]*>[^<]*<\/a>/, "")
        .replace('<a class="pagination-link is-current">1</a>', '<a class="pagination-link is-current">2</a>');
    const pageRequests = [];
    await fulfillHostFixtures(context);
    await context.route(url => url.origin === "https://javdb.com" && url.pathname === "/", async route => {
        const request = route.request();
        if (!request.isNavigationRequest()) pageRequests.push(request.url());
        const number = new URL(request.url()).searchParams.get("page");
        await route.fulfill({ contentType: "text/html; charset=utf-8", body: number === "2" ? second : first });
    });
    await page.goto(listUrl);
    await injectUserscriptRuntime(page, { settingOverrides: { autoPage: "yes", defaultQuickFilterTab: "all", themeMode: "light" } });

    await expect(page.locator("#results > .item .video-title strong")).toHaveText(["ABC-001", "ABC-002", "ABC-003", "ABC-004"]);
    await expect(page.locator("#weekly > .item .video-title strong")).toHaveText(["ABC-001"]);
    expect(pageRequests).toEqual([`${listUrl}&page=2`]);
    const pagination = page.locator("section > .pagination");
    await expect(pagination.locator(".pagination-link.is-current")).toHaveText("2");
    const jump = pagination.getByRole("button", { name: "跳转", exact: true });
    await expect(jump).toBeVisible();
    await page.locator("section").screenshot({ path: info.outputPath("javdb-outer-pagination.png") });

    await pagination.locator("#jumpPageInput").fill("4");
    await Promise.all([page.waitForURL(`${listUrl}&page=4`), jump.click()]);
});

for (const theme of ["light", "dark"]) test(`home list ownership ${theme}`, async ({context,page}, info) => {
 test.skip(!["desktop-wide","mobile"].includes(info.project.name));
 await fulfillHostFixtures(context);
 await context.route("https://javdb.com/", route=>route.fulfill({contentType:"text/html",body:fixture}));
 await page.goto("https://javdb.com/");
 const original = await page.locator("#weekly .item").elementHandle();
 await injectUserscriptRuntime(page,{settingOverrides:{enableLoadReview:"no",autoPage:"no",sortMethod:"rateCount",defaultQuickFilterTab:"all",themeMode:theme}});
 await expect(page.locator('#results')).toHaveAttribute('data-jhs-primary-list','true');
 await expect(page.locator('#weekly')).not.toHaveAttribute('data-jhs-primary-list','true');
 await expect(page.locator('#weekly .item')).toHaveCount(1);
 await expect(page.locator('#results .video-title strong')).toHaveText(['ABC-002','ABC-001']);
 expect(await original.evaluate(e=>e.parentElement.id)).toBe("weekly");
 if (info.project.name === 'desktop-wide') expect(await page.locator('#jhs-page-commandbar').evaluate(e=>e.nextElementSibling.id)).toBe('results');
 else await expect(page.locator('#jhs-fab')).toBeVisible();
 await expect(page.locator('#weekly .jhs-cover-tools')).toHaveCount(1);
 await expect(page.locator('#weekly')).toHaveAttribute('data-jhs-card-list','true');
 if (process.env.JHS_VISUAL_REGRESSION === '1') await expect(page.locator('section > .container')).toHaveScreenshot(`home-boundary-${theme}.png`);
 if (info.project.name === "desktop-wide") await page.locator('[data-jhs-filter="favorite"]').first().click();
 else await page.evaluate(() => window.__jhsBrowserDiagnostics.features["list.core"].setQuickFilter("favorite"));
 await expect(page.locator('#results > .item:visible')).toHaveCount(0);
 await expect(page.locator('#weekly > .item')).toBeVisible();
 expect(await original.evaluate(e=>e.parentElement.id)).toBe("weekly");
});


test("recommendation cards support previews, state actions and late insertion", async ({context,page},info)=>{
 test.skip(info.project.name !== "desktop-wide");
 await fulfillHostFixtures(context);
 await context.route("https://javdb.com/",route=>route.fulfill({contentType:"text/html",body:fixture.replaceAll('src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"','src="https://c0.jdbstatic.com/thumbs/top-fixture.jpg"')}));
 await context.route("https://c0.jdbstatic.com/**",route=>route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#cad9e8"/></svg>'}));
 await page.goto("https://javdb.com/");
 await injectUserscriptRuntime(page,{settingOverrides:{autoPage:"no",hoverBigImg:"yes",defaultQuickFilterTab:"all"}});
 await expect(page.locator("#weekly .cover img")).toHaveAttribute("data-hd-replaced","true");
 await page.locator("#weekly .cover img").hover();
 await expect(page.locator(".image-hover-preview.active img")).toBeVisible();
 await page.mouse.move(1200,10);
 const trigger=page.locator("#weekly .handleSvg .jhs-card-menu-trigger");
 await trigger.click();await page.locator(".jhs-card-menu.is-open .favoriteBtn").click();
 await expect(page.locator("#weekly .jhs-status-tags")).toContainText("收藏");
 await expect(page.locator("#results .item").filter({has:page.locator('strong',{hasText:'ABC-001'})}).locator(".jhs-status-tags")).toContainText("收藏");
 await expect(trigger).toBeFocused();
 await page.evaluate(()=>{const root=document.querySelector('#weekly').cloneNode(true);root.id='late';root.querySelectorAll('.jhs-cover-tools,.jhs-status-tags').forEach(e=>e.remove());document.querySelector('.container').prepend(root);});
 await expect(page.locator("#late .jhs-cover-tools")).toHaveCount(1);
 await expect(page.locator("#late .jhs-status-tags")).toContainText("收藏");
 await page.evaluate(()=>window.__jhsBrowserDiagnostics.features["settings.core"].getRuntimeService("settings").set("hoverBigImg","no"));
 await expect(page.locator(".image-hover-preview")).toHaveCount(0);
 await page.locator("#late").evaluate(e=>e.remove());
 await expect(page.locator("#weekly .jhs-cover-tools")).toHaveCount(1);
});
