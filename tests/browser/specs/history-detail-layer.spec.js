import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test("history detail and its shade stay above history across close and reopen", async ({ context, page }) => {
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    const addScript = page.addScriptTag.bind(page);
    page.addScriptTag = async options => {
        if (options.path?.endsWith("JHS.user.js")) {
            await addScript({ path: fileURLToPath(new URL("../fixtures/layer-runtime/layer-1.0.9.min.js", import.meta.url)) });
        }
        return addScript(options);
    };
    await injectUserscriptRuntime(page, { settingOverrides: { enableLoadReview: "no" } });
    await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
    await page.evaluate(() => {
        const history = window.unsafeWindow.pluginManager.getBean("HistoryPlugin");
        history.historyRepository.list = async () => [{
            carNum: "ABC-123", url: "https://javdb.com/v/test-id", names: "Fixture",
            stateFlags: { downloaded: true }, createdAt: "2026-09-18", updatedAt: "2026-09-18",
        }];
    });

    for (let cycle = 0; cycle < 3; cycle++) {
        await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("HistoryPlugin").openHistory());
        const history = page.locator(".layui-layer-page").filter({ has: page.locator(".jhs-history-dialog") });
        await expect(history.locator(".history-detailBtn")).toBeVisible();
        const historyStack = await page.evaluate(() => [...window.utils.layerIndexStack]);
        for (const closeMethod of ["button", "escape"]) {
            await history.locator(".history-detailBtn").click();
            const detail = page.locator(".layui-layer-iframe");
            await expect(detail.locator("iframe")).toBeVisible();
            await expect(detail).toHaveClass(/jhs-dialog/);
            const ordering = await detail.evaluate(node => {
                const owner = document.querySelector(".jhs-history-dialog").closest(".layui-layer");
                const shade = document.getElementById(node.id.replace("layui-layer", "layui-layer-shade"));
                const rect = node.getBoundingClientRect();
                return {
                    owner: Number(getComputedStyle(owner).zIndex),
                    shade: Number(getComputedStyle(shade).zIndex),
                    detail: Number(getComputedStyle(node).zIndex),
                    onTop: node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)),
                    paintOrder: document.elementsFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
                        .map(element => element === node ? "detail" : element === shade ? "shade" : element === owner ? "history" : null).filter(Boolean),
                };
            });
            // Layer gives the later shade the parent's z-index; DOM paint order must still cover the parent.
            expect(ordering.paintOrder).toEqual(["detail", "shade", "history"]);
            expect(ordering.detail).toBeGreaterThan(ordering.owner);
            expect(ordering.detail).toBeGreaterThan(ordering.shade);
            expect(ordering.onTop).toBe(true);
            if (closeMethod === "button") await detail.getByRole("button", { name: "关闭弹窗" }).click();
            else await page.frameLocator(".layui-layer-iframe iframe").locator("body").press("Escape");
            await expect(detail).toHaveCount(0);
            await expect(history).toBeVisible();
            expect(await page.evaluate(() => window.utils.layerIndexStack)).toEqual(historyStack);
        }
        await history.getByRole("button", { name: "关闭弹窗" }).click();
        await expect(page.locator(".layui-layer, .layui-layer-shade")).toHaveCount(0);
        expect(await page.evaluate(() => window.utils.layerIndexStack)).toEqual([]);
    }
});
