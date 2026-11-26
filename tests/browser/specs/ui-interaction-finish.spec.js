import { test, expect } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { injectRealLayer } from "../harness/real-layer.js";

test.beforeEach(({}, info) => test.skip(info.project.name === "firefox-controls", "six Chromium viewport coverage"));

async function openFc2(page, context, theme) {
    await fulfillHostFixtures(context);
    await context.route("https://images.example.test/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#63768c"/></svg>' }));
    await page.goto("https://javdb.com/search_advanced?type=3");
    await injectUserscriptRuntime(page, {
        hostStyles: true, realFeedback: true, beforeUserscriptInjection: injectRealLayer,
        settingOverrides: { themeMode: theme, defaultQuickFilterTab: "all", enableLoadReview: "no", enableLoadRelated: "no", enableLoadScreenShot: "no", enableLoadOtherSite: "no" },
    });
    await page.evaluate(() => {
        const fc2 = window.__jhsBrowserDiagnostics.features["detail.fc2-owned"], get = fc2.getRuntimeService.bind(fc2);
        fc2.resolveMovieIdForRecord = async () => "fixture-id";
        fc2.resolveFc2Source = async () => "fc2";
        fc2.fetchAndRenderNativeMagnets = async () => {};
        fc2.configureJavDbWantButton = async () => {};
        fc2.getRuntimeService = name => name === "movie" ? new Proxy(get(name), { get(target, key) { return key === "detail" ? async () => ({ title: "合成 FC2 长正文", carNum: "FC2-4959150", imageUrls: ["https://images.example.test/1.svg", "https://images.example.test/2.svg"] }) : target[key]; } }) : get(name);
        document.body.style.minHeight = "3000px";
    });
    const opener = page.locator('.movie-list a[data-jhs-fc2-primary="true"]').first();
    await opener.click();
    await expect(page.getByRole("button", { name: "查看剧照 2", exact: true })).toBeVisible();
    await page.evaluate(() => {
        const workspace = document.querySelector('.jhs-fc2-workspace');
        const summary = workspace.querySelector('[data-jhs-slot="summary"]');
        const probe = document.createElement('div');
        probe.innerHTML = '<p data-wheel="text">正文文字滚轮测试</p><div class="jhs-fc2-preview"><img data-wheel="image" src="https://images.example.test/1.svg" alt="合成封面"></div><button type="button" class="jhs-btn" data-wheel="button">合成正文操作</button><div data-wheel="blank" style="height:80px"></div>';
        summary.prepend(probe);
        for (const section of workspace.querySelectorAll('[data-jhs-slot]')) for (let i = 0; i < 16; i++) { const p = document.createElement('p'); p.textContent = `合成长正文 ${i}：资源和评论滚动验证`; section.append(p); }
        const last = document.createElement('button'); last.type = 'button'; last.className = 'jhs-btn'; last.textContent = '末尾操作';
        last.addEventListener('click', () => last.dataset.activated = 'true'); workspace.lastElementChild.append(last);
    });
    return { opener, workspace: page.locator('.jhs-fc2-workspace'), dialog: page.locator('.movie-detail-layer') };
}

for (const theme of ["light", "dark"]) {
    test(`FC2正文滚轮、边界与Viewer恢复 ${theme}`, async ({ page, context }, info) => {
        const { opener, workspace, dialog } = await openFc2(page, context, theme);
        await expect(dialog).toHaveAttribute('role', 'dialog');
        expect(await workspace.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
        const background = await page.evaluate(() => document.scrollingElement.scrollTop);
        for (const kind of ['text', 'image', 'button', 'blank']) {
            await workspace.evaluate(node => node.scrollTop = 0);
            const target = workspace.locator(`[data-wheel="${kind}"]`);
            await target.scrollIntoViewIfNeeded(); await target.hover();
            const before = await workspace.evaluate(node => node.scrollTop);
            await page.mouse.wheel(0, 160);
            await expect.poll(() => workspace.evaluate(node => node.scrollTop)).toBeGreaterThan(before);
            expect(await page.evaluate(() => document.scrollingElement.scrollTop)).toBe(background);
        }
        if (info.project.use.hasTouch) {
            await workspace.evaluate(node => node.scrollTop = 0);
            const target = workspace.locator('[data-wheel="text"]'); await target.scrollIntoViewIfNeeded();
            const box = await target.boundingBox(), before = await workspace.evaluate(node => node.scrollTop);
            const session = await context.newCDPSession(page);
            try {
                const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1, radiusX: 4, radiusY: 4, force: 1 };
                const distance = Math.min(150, point.y - 12);
                await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
                for (let step = 1; step <= 12; step++) {
                    await page.waitForTimeout(25);
                    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y - distance * step / 12 }] });
                }
                await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            }
            finally { await session.detach(); }
            await expect.poll(() => workspace.evaluate(node => node.scrollTop)).toBeGreaterThan(before);
            expect(await page.evaluate(() => document.scrollingElement.scrollTop)).toBe(background);
        }
        await workspace.evaluate(node => node.scrollTop = 0);
        const first = await dialog.locator('a[href],button:not(:disabled),input:not(:disabled),[tabindex="0"]').evaluateAll(nodes => nodes.filter(node => node.offsetParent !== null)[0]?.id);
        await dialog.locator('.layui-layer-close').focus(); await page.keyboard.press('Tab');
        expect(await page.evaluate(() => document.activeElement.closest('.movie-detail-layer') !== null)).toBe(true);
        if (first) expect(await page.evaluate(() => document.activeElement.id)).toBe(first);
        const gallery = page.getByRole('button', { name: '查看剧照 2', exact: true });
        await gallery.click(); await expect(page.locator('.viewer-container.viewer-in')).toHaveCount(1);
        await page.keyboard.press('Escape'); await expect(page.locator('.viewer-container,.jhs-image-viewer-host')).toHaveCount(0);
        await expect(gallery).toBeFocused(); await expect(workspace).not.toHaveAttribute('inert');
        await workspace.locator('[data-wheel="text"]').scrollIntoViewIfNeeded(); await workspace.locator('[data-wheel="text"]').hover();
        const restored = await workspace.evaluate(node => node.scrollTop); await page.mouse.wheel(0, 160);
        await expect.poll(() => workspace.evaluate(node => node.scrollTop)).toBeGreaterThan(restored);
        await workspace.evaluate(node => node.scrollTop = node.scrollHeight); await workspace.getByRole('button', { name: '末尾操作' }).click();
        await expect(workspace.getByRole('button', { name: '末尾操作' })).toHaveAttribute('data-activated', 'true');
        const end = await workspace.evaluate(node => node.scrollTop); await workspace.getByRole('button', { name: '末尾操作' }).hover(); await page.mouse.wheel(0, 200);
        expect(await workspace.evaluate(node => node.scrollTop)).toBe(end);
        expect(await page.evaluate(() => document.scrollingElement.scrollTop)).toBe(background);
        await page.screenshot({ path: info.outputPath(`fc2-scroll-${theme}.png`) });
        await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
        await page.mouse.move(10, 300); await page.mouse.wheel(0, 200);
        await expect.poll(() => page.evaluate(() => document.scrollingElement.scrollTop)).toBeGreaterThan(background);
    });

    test(`快捷设置独立滚动锁、重开与清理 ${theme}`, async ({ page, context }, info) => {
        await fulfillHostFixtures(context); await page.goto('https://javdb.com/');
        await injectUserscriptRuntime(page, { hostStyles: true, realFeedback: true, beforeUserscriptInjection: injectRealLayer, settingOverrides: { themeMode: theme } });
        await page.evaluate(() => document.body.style.minHeight = '3000px');
        if (await page.locator('#jhs-fab').isVisible()) {
            await page.locator('#jhs-fab').tap(); await page.locator('#jhs-fab-menu [data-action="setting"]').tap();
        } else await page.evaluate(() => window.__jhsBrowserDiagnostics.features["settings.core"].openQuickSetting());
        const sheet = page.locator('#jhs-quick-setting-sheet'), scroller = sheet.locator('.simple-setting__scroll');
        await expect(sheet).toHaveAttribute('role', 'dialog'); await expect(sheet.getByRole('button', { name: '关闭快捷设置' })).toBeFocused();
        const background = await page.evaluate(() => document.scrollingElement.scrollTop);
        await scroller.evaluate(node => { const content = document.createElement('p'); content.textContent = '合成长设置'; content.style.height = '1200px'; node.append(content); });
        await scroller.hover(); await page.mouse.wheel(0, 150);
        await expect.poll(() => scroller.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
        expect(await page.evaluate(() => document.scrollingElement.scrollTop)).toBe(background);
        await page.evaluate(() => window.__jhsBrowserDiagnostics.features["settings.core"].openQuickSetting());
        await expect(sheet).toHaveCount(1); await expect(page.locator('#jhs-quick-setting-backdrop')).toHaveCount(1);
        await sheet.locator('#moreBtn').focus(); await page.keyboard.press('Tab');
        await expect(sheet.getByRole('button', { name: '关闭快捷设置' })).toBeFocused();
        await page.screenshot({ path: info.outputPath(`quick-settings-${theme}.png`) });
        await page.keyboard.press('Escape'); await expect(sheet).toHaveCount(0); await expect(page.locator('#jhs-quick-setting-backdrop')).toHaveCount(0);
        await page.mouse.move(10, 300); await page.mouse.wheel(0, 200);
        await expect.poll(() => page.evaluate(() => document.scrollingElement.scrollTop)).toBeGreaterThan(background);
        await page.evaluate(async () => { const setting = window.__jhsBrowserDiagnostics.features["settings.core"]; await setting.openQuickSetting(); setting.disposeQuickSettings(); });
        await expect(sheet).toHaveCount(0); await expect(page.locator('#jhs-quick-setting-backdrop')).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.style.overflow)).not.toBe('hidden');
    });
}
