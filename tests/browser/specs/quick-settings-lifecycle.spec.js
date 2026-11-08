import { test, expect } from '@playwright/test';
import { fulfillHostFixtures, injectUserscriptRuntime } from '../harness/runtime.js';
import { injectRealLayer } from '../harness/real-layer.js';

for (const theme of ['light', 'dark']) {
    for (const path of ['/', '/ABC-123']) {
        test(`JavBus quick settings recover after full settings ${path} ${theme}`, async ({ page, context }, info) => {
            test.skip(info.project.use.hasTouch, 'Desktop hover interaction');
            await fulfillHostFixtures(context);
            await page.goto(`https://www.javbus.com${path}`);
            await injectUserscriptRuntime(page, {
                hostStyles: true,
                realFeedback: true,
                beforeUserscriptInjection: injectRealLayer,
                settingOverrides: {
                    themeMode: theme, autoPage: 'no', translateTitle: 'no',
                    enableLoadPreviewVideo: 'no', enableLoadScreenShot: 'no',
                    enableLoadOtherSite: 'no', enableLoadReview: 'no',
                },
            });
            const trigger = page.locator('#setting-btn');
            const panel = page.locator('.simple-setting');
            await trigger.hover();
            await expect(panel).toBeVisible();
            await expect(panel.locator('.simple-setting__list')).toBeVisible();
            const bounds = await panel.boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
            await trigger.click();
            await expect(page.locator('#saveBtn')).toHaveAttribute('data-jhs-settings-ready', 'true');
            await expect(panel).toBeHidden();
            await page.keyboard.press('Escape');
            await expect(page.locator('#saveBtn')).toHaveCount(0);
            await page.mouse.move(4, 200);
            await trigger.hover();
            await expect(panel).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(panel).toBeHidden();
            await expect(trigger).toBeFocused();
            await trigger.press('ArrowDown');
            await expect(panel).toBeVisible();
            await expect(panel.locator('input,button').first()).toBeFocused();
        });
    }
}
