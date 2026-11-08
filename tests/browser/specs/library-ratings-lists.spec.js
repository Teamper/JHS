import { openDetailEnhancements, enterMovieSelection, openUtility } from "../harness/enhancement-navigation.js";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

async function boot(page, context, theme, detail = false, setup = async () => {}) {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await fulfillHostFixtures(context);
    if (detail === true) {
        const html = await readFile(new URL("../fixtures/javdb-detail-interactions.html",import.meta.url),"utf8");
        await context.route("https://javdb.com/v/**",route=>route.fulfill({contentType:"text/html",body:html}));
    }
    await setup();
    await page.goto(detail === "fc2" ? "https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-1234567&url=https%3A%2F%2Fjavdb.com%2Fv%2Ffixture-id&source=fc2" : detail ? "https://javdb.com/v/test-id" : "https://javdb.com/");
    await page.evaluate(() => {
        const nav = document.querySelector("#navbar-menu-user") || document.body;
        const link = document.createElement("a"); link.href = "/users/edit"; link.textContent = "账号设置"; nav.append(link);
    });
    await injectUserscriptRuntime(page, {
        hostStyles:true, realFeedback:true,
        settingOverrides:{themeMode:theme,defaultQuickFilterTab:"all",translateTitle:"no",enableLoadPreviewVideo:"no",enableLoadScreenShot:"no",enableLoadReview:"no",enableLoadOtherSite:"no",enableLoadRelatedList:"no"},
        beforeUserscriptInjection: async host => { await host.addScriptTag({path:fileURLToPath(new URL("../fixtures/layer-runtime/layer-1.0.9.min.js",import.meta.url))}); },
    });
    await page.waitForFunction(()=>window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
    return errors;
}

for (const theme of ["light","dark"]) {
    test(`personal ratings work through native selection, history and clearing ${theme}`,async({page,context},info)=>{
        const errors = await boot(page,context,theme);
        await enterMovieSelection(page);
        const selection = page.locator(".jhs-movie-selection");
        await expect(selection).toBeVisible();
        if (!await page.locator(".jhs-movie-selection").count()) await enterMovieSelection(page);
        await page.getByRole("checkbox",{name:"选择 ABC-123",exact:true}).check();
        await selection.getByRole("button",{name:"批量评分",exact:true}).click();
        const editor = page.locator(".jhs-rating-editor");
        await expect(editor).toContainText("所选 1 部影片");
        await editor.getByRole("radio",{name:"4 星",exact:true}).click();
        await expect(editor.getByRole("radio",{name:"4 星",exact:true})).toHaveAttribute("aria-checked","true");
        await expect(page.locator(".jhs-rating-badge")).toHaveText("个人 4 星");
        await editor.screenshot({path:info.outputPath("rating-editor.png")});
        await page.locator(".layui-layer-page").filter({has:editor}).locator(".layui-layer-close").click();
        await expect(editor).toHaveCount(0);
        await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean("HistoryPlugin").openHistory());
        const history = page.locator(".jhs-history-dialog");
        await expect(history.locator(".tabulator-row")).toHaveCount(1);
        const ratingButton = history.getByRole("button",{name:"设置 ABC-123 的个人评分",exact:true});
        if (!await ratingButton.isVisible()) await history.getByRole("button",{name:"展开影片资料",exact:true}).click();
        await expect(ratingButton).toBeVisible();
        await expect(history).toContainText("4 星");
        const sort = history.locator("#historySort");
        await sort.selectOption("personalRating:desc",{force:true});
        await expect(history.locator(".tabulator-row")).toHaveCount(1);
        if (!await ratingButton.isVisible()) await history.getByRole("button",{name:"展开影片资料",exact:true}).click();
        await ratingButton.click();
        await editor.getByRole("button",{name:"清除评分",exact:true}).click();
        await expect(editor).toContainText("未评分");
        await expect(page.locator(".jhs-rating-badge")).toBeHidden();
        await expect.poll(async()=>page.evaluate(async()=>{
            const forage=window.localforage.createInstance({name:"JAV-JHS",storeName:"appData"});
            return (await forage.getItem("personal_ratings")) || {};
        })).toEqual({});
        expect(errors).toEqual([]);
    });

    test(`existing JavDB lists review, verify an ambiguous submission and show durable progress ${theme}`,async({page,context},info)=>{
        let checked = false, submits = 0;
        const accountHtml = await readFile(new URL("../../fixtures/integrations/javdb/web-account.html",import.meta.url),"utf8");
        const errors = await boot(page,context,theme,false,async()=>{
            await context.route("https://javdb.com/users/edit",route=>route.fulfill({contentType:"text/html",body:accountHtml}));
            await context.route("https://javdb.com/users/simple_lists**",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({lists:`<label><input type="checkbox" data-list-id="one" ${checked?"checked":""}>现有清单 <span>(1)</span></label>`})}));
            await context.route("https://javdb.com/users/save_video_to_list",async route=>{
                const request=route.request(), data=request.postDataJSON();
                expect(request.headers()["x-csrf-token"]).toBe("fixture-csrf-token");
                expect(data).toMatchObject({video_id:"abc-123",list_id:"one",checked:true});
                checked = true; submits++;
                await route.abort("failed");
            });
        });
        if (!await page.locator(".jhs-movie-selection").count()) await enterMovieSelection(page);
        await page.getByRole("checkbox",{name:"选择 ABC-123",exact:true}).check();
        await page.getByRole("button",{name:"管理清单与恢复",exact:true}).click();
        const panel=page.locator(".jhs-movie-lists");
        await expect(panel).toContainText("已选 1 部影片");
        await panel.getByRole("checkbox",{name:/现有清单/}).check();
        await panel.getByRole("button",{name:"预览操作范围",exact:true}).click();
        await expect(panel.locator(".jhs-list-range")).toContainText("ABC-123");
        await panel.screenshot({path:info.outputPath("list-preview.png")});
        expect(submits).toBe(0);
        await panel.getByRole("button",{name:"确认并开始",exact:true}).click();
        await expect(panel).toContainText("成功 1，失败 0，待确认 0，未开始 0");
        expect(submits).toBe(1);
        const task=panel.locator(".jhs-list-task");
        if (!await task.evaluate(node=>node.open)) await task.locator(":scope > summary").click();
        await expect(task.getByText(/网站已确认目标成员状态/)).toBeVisible();
        await expect(panel.locator(".jhs-list-directory")).toContainText("已加入当前影片");
        await expect(panel.getByRole("button",{name:"确认并开始",exact:true})).toBeHidden();
        await panel.screenshot({path:info.outputPath("list-progress.png")});
        await page.locator(".layui-layer-page").filter({has:panel}).locator(".layui-layer-close").click();
        await expect(panel).toHaveCount(0);
        await page.getByRole("button",{name:"管理清单与恢复",exact:true}).click();
        await expect(panel).toContainText("成功 1，失败 0，待确认 0，未开始 0");
        expect(submits).toBe(1);
        expect(errors).toEqual([]);
    });

    for (const detail of [true,"fc2"]) test(`detail rating keyboard and list entry ${detail === true ? "native" : "fc2"} ${theme}`,async({page,context},info)=>{
        const errors = await boot(page,context,theme,detail);
        await openDetailEnhancements(page);
        await page.locator(".jhs-personal-rating-entry").click();
        const control = page.locator(".jhs-personal-rating");
        await expect(control).toHaveCount(1);
        await expect(control).toBeVisible();
        const first = control.getByRole("radio",{name:"1 星",exact:true});
        await first.focus();
        await first.press("End");
        await expect(control.getByRole("radio",{name:"5 星",exact:true})).toHaveAttribute("aria-checked","true");
        await expect(control.getByRole("radio",{name:"5 星",exact:true})).toBeFocused();
        await control.getByRole("button",{name:"清除评分",exact:true}).click();
        await expect(control).toContainText("未评分");
        await page.keyboard.press("Escape");
        await expect(control).toHaveCount(0);
        await expect(page.getByRole("button",{name:"JavDB 清单",exact:true})).toBeVisible();
        await page.locator(".jhs-detail-extra-actions").screenshot({path:info.outputPath("detail-rating.png")});
        expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
        expect(errors).toEqual([]);
    });
}
