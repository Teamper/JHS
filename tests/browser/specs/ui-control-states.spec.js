import { test, expect, chromium } from "@playwright/test";
import { boot } from "../harness/ui-root-scenes.js";

const image = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400'%3E%3Crect width='600' height='400' fill='%2363768c'/%3E%3C/svg%3E";
async function probe(page) {
    await page.evaluate(() => {
        const host = document.createElement("div"); host.id = "host-control-probe";
        host.innerHTML = '<input type="checkbox"><input type="number"><div style="height:30px;overflow:auto"><div style="height:90px">宿主滚动区</div></div>';
        document.body.append(host);
        const root = document.createElement("section"); root.id = "control-probe"; root.className = "jhs-ui";
        root.style.cssText = "position:fixed;inset:16px;bottom:auto;max-height:calc(100vh - 32px);overflow:auto;padding:16px;background:var(--jhs-surface);z-index:9999999;display:grid;gap:8px";
        root.innerHTML = '<button class="jhs-btn jhs-btn--primary" id="primary">操作</button><button class="jhs-btn jhs-btn--primary" disabled id="disabled">禁用</button><a href="#probe" class="jhs-btn" aria-disabled="true" id="aria-disabled">禁用链接按钮</a><input aria-label="文字" class="jhs-field" id="text"><input type="number" aria-label="数字"><input type="color" aria-label="颜色"><label>复选框<input type="checkbox" id="checkbox"></label><label>单选<input type="radio" id="radio"></label><label>即时设置<input type="checkbox" class="mini-switch" role="switch" id="switch"></label><input type="range" aria-label="范围" min="0" max="100" value="30" id="range"><a href="#probe" id="link">文字链接</a><div role="tablist"><button class="jhs-btn jhs-btn--secondary jhs-tab" role="tab" aria-selected="true" id="selected-tab">来源一</button><button class="jhs-btn jhs-btn--secondary jhs-tab" role="tab" aria-selected="false">来源二</button></div><label id="select-label" for="source">来源选择</label><span id="select-help">选择后提交</span><select class="jhs-select-source" id="source" required aria-describedby="select-help"><option value="a">Alpha</option><option disabled>Beta</option><optgroup disabled label="不可用"><option>Charlie</option></optgroup><option value="d">Delta</option><option value="e">Echo</option></select><button class="jhs-btn" id="after-select">后续操作</button><div class="jhs-code-viewer" id="scroll-probe" style="max-height:20px;overflow:auto"><div style="height:60px">内容</div></div><div class="jhs-skeleton">装饰骨架</div>';
        document.body.append(root);
        const plugin = window.unsafeWindow.pluginManager.getBean("SettingPlugin");
        plugin.domUi.enhanceSelect(root);
        window.__controlChanges = 0; window.__disabledActions = 0;
        root.querySelector("#source").addEventListener("change", () => window.__controlChanges++);
        root.querySelector("#aria-disabled").addEventListener("click", () => window.__disabledActions++);
    });
    await expect(page.locator("#link")).toHaveClass(/jhs-link/);
}
const styles = locator => locator.evaluate(node => {
    const s = getComputedStyle(node), r = node.getBoundingClientRect();
    return { background: s.backgroundColor, border: s.borderColor, shadow: s.boxShadow, outline: s.outlineWidth, outlineStyle: s.outlineStyle, transform: s.transform, colorScheme: s.colorScheme, color: s.color, width: r.width, height: r.height };
});

for (const theme of ["light", "dark"]) {
    test(`isolated native autofill keeps owned field background text and caret ${theme}`, async ({ browserName }, info) => {
        test.skip(browserName !== "chromium", "Native Autofill CDP bridge is Chromium only; Firefox field states run separately");
        // Autofill is a full-browser capability, absent from the default headless shell.
        const browser = await chromium.launch({ channel: "chromium", headless: true });
        try {
            const { viewport, hasTouch, isMobile } = info.project.use;
            const context = await browser.newContext({ viewport, hasTouch, isMobile, serviceWorkers: "block" });
            const page = await context.newPage();
            await boot(page, context, theme);
            await page.evaluate(() => {
                const form = document.createElement("form"); form.className = "jhs-ui";
                form.style.cssText = "position:fixed;top:20px;left:20px;z-index:9999999;background:var(--jhs-surface)";
                form.innerHTML = '<input class="jhs-field" id="autofill-name" name="name" autocomplete="name" aria-label="姓名"><input class="jhs-field" name="address" autocomplete="street-address" aria-label="地址"><input class="jhs-field" name="city" autocomplete="address-level2" aria-label="城市"><input class="jhs-field" name="zip" autocomplete="postal-code" aria-label="邮编">';
                document.body.append(form);
            });
            const field = page.locator("#autofill-name"), before = await styles(field), session = await context.newCDPSession(page);
            const { root } = await session.send("DOM.getDocument");
            const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#autofill-name" });
            const { node } = await session.send("DOM.describeNode", { nodeId });
            await field.focus();
            await session.send("Autofill.trigger", { fieldId: node.backendNodeId, address: { fields: [
                { name: "NAME_FULL", value: "JHS Test User" }, { name: "ADDRESS_HOME_STREET_ADDRESS", value: "123 Test Avenue" },
                { name: "ADDRESS_HOME_CITY", value: "Testville" }, { name: "ADDRESS_HOME_STATE", value: "CA" },
                { name: "ADDRESS_HOME_ZIP", value: "94043" }, { name: "ADDRESS_HOME_COUNTRY", value: "US" }
            ] } });
            await expect(field).toHaveValue("JHS Test User");
            expect(await field.evaluate(n => n.matches(":autofill"))).toBe(true);
            const autofill = await field.evaluate(n => { const s = getComputedStyle(n); return { shadow: s.boxShadow, fill: s.webkitTextFillColor, caret: s.caretColor, text: s.color }; });
            expect(autofill.shadow).toContain("1000px"); expect(autofill.shadow).toContain(before.background);
            expect(autofill.fill).toBe(before.color); expect(autofill.caret).toBe(before.color); await session.detach();
        } finally { await browser.close(); }
    });
    test(`owned component state matrix and host boundary ${theme}`, async ({ page, context }, info) => {
        const nativeScrollbar = await page.evaluate(() => {
            const node = document.createElement("div"); document.body.append(node);
            const auto = getComputedStyle(node).scrollbarWidth; node.style.scrollbarWidth = "thin";
            const thin = getComputedStyle(node).scrollbarWidth; node.remove(); return { auto, thin };
        });
        await boot(page, context, theme); await page.emulateMedia({ reducedMotion: "reduce" }); await probe(page);
        const root = page.locator("#control-probe"), button = root.locator("#primary"), matrix = [];
        expect((await styles(root)).colorScheme).toBe(theme);
        expect(await page.locator("#host-control-probe input").first().evaluate(n => getComputedStyle(n).accentColor)).toBe("auto");
        expect(await page.locator("#host-control-probe").evaluate(n => getComputedStyle(n).colorScheme)).toBe("normal");
        expect(await page.locator("#host-control-probe div").first().evaluate(n => getComputedStyle(n).scrollbarWidth)).toBe(nativeScrollbar.auto);
        expect(await page.locator("#scroll-probe").evaluate(n => getComputedStyle(n).scrollbarWidth)).toBe(info.project.use.hasTouch ? nativeScrollbar.auto : nativeScrollbar.thin);
        expect(await page.locator("#scroll-probe").evaluate(n => getComputedStyle(n).overscrollBehavior)).toBe("auto");
        for (const selector of ["#primary", "#text", "#checkbox", "#radio", "#switch", "#range", "#link", "#selected-tab", ".jhs-select-trigger"]) {
            const control = root.locator(selector); await control.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0);
            const normal = await styles(control); await control.hover(); const hover = await styles(control);
            await page.keyboard.press("Tab"); await control.focus();
            await expect(control).toHaveCSS("outline-style", "solid"); await expect(control).toHaveCSS("outline-width", "2px");
            matrix.push({ selector, normal, hover, focus: await styles(control) });
        }
        await button.hover(); const before = await styles(button); await page.mouse.down(); const active = await styles(button); await page.mouse.up();
        expect(active.transform).toBe(before.transform); expect(active.shadow).not.toBe("none"); matrix.push({ selector: "#primary", active });
        const disabled = root.locator("#disabled"); const disabledNormal = await styles(disabled); await disabled.hover({ force: true });
        expect((await styles(disabled)).background).toBe(disabledNormal.background);
        await root.locator("#aria-disabled").evaluate(n => n.click()); await root.locator("#aria-disabled").focus(); await page.keyboard.press("Enter");
        expect(await page.evaluate(() => window.__disabledActions)).toBe(0);
        await root.locator("#checkbox").check(); await root.locator("#radio").check(); await root.locator("#switch").check();
        expect(await root.locator("#checkbox").evaluate(n => getComputedStyle(n).width)).toBe("18px");
        const checkedPosition = await root.locator("#switch").evaluate(n => getComputedStyle(n, "::before").transform);
        await root.locator("#switch").uncheck(); await expect.poll(() => root.locator("#switch").evaluate(n => getComputedStyle(n, "::before").transform)).not.toBe(checkedPosition);
        if (info.project.name === "firefox-controls") {
            const range = root.locator("#range");
            const slider = await range.evaluate(n => ({ thumb: getComputedStyle(n, "::-moz-range-thumb").width, track: getComputedStyle(n, "::-moz-range-track").height }));
            expect(slider).toEqual({ thumb: "18px", track: "4px" });
            await range.evaluate(n => n.disabled = true);
            const disabledSlider = await range.evaluate(n => {
                const marker = document.createElement("i"); marker.style.color = "var(--jhs-disabled-text)"; n.parentElement.append(marker);
                const result = { actual: getComputedStyle(n, "::-moz-range-thumb").backgroundColor, expected: getComputedStyle(marker).color }; marker.remove(); return result;
            });
            expect(disabledSlider.actual).toBe(disabledSlider.expected);
            await range.evaluate(n => n.disabled = false);
        }
        await expect(root.locator(".jhs-skeleton")).toHaveAttribute("aria-hidden", "true");
        expect((await styles(root.locator("#selected-tab"))).shadow).not.toBe("none");
        await root.locator("#selected-tab").evaluate(n => n.disabled = true);
        await expect(root.locator("#selected-tab")).toHaveCSS("text-decoration-line", "underline");
        await page.emulateMedia({ contrast: "more" }); await button.focus();
        await expect(button).toHaveCSS("outline-width", "3px");
        await page.emulateMedia({ contrast: "no-preference" });
        await page.emulateMedia({ forcedColors: "active" });
        await expect(root.locator("#scroll-probe")).toHaveCSS("scrollbar-width", nativeScrollbar.auto);
        await root.locator("#switch").check(); expect(await root.locator("#switch").evaluate(n => getComputedStyle(n, "::before").borderTopStyle)).toBe("solid");
        await info.attach(`control-states-${theme}.json`, { body: JSON.stringify(matrix, null, 2), contentType: "application/json" });
    });

    test(`combobox commit cancel disabled groups and tooltip Escape priority ${theme}`, async ({ page, context }) => {
        await boot(page, context, theme); await probe(page);
        const trigger = page.locator("#control-probe .jhs-select-trigger"), source = page.locator("#source");
        await expect(trigger).toHaveAccessibleName("来源选择"); await expect(trigger).toHaveAttribute("aria-describedby", "select-help"); await expect(trigger).toHaveAttribute("aria-required", "true");
        await trigger.focus(); await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown");
        await expect(trigger).toBeFocused(); await expect(source).toHaveValue("a");
        await expect(page.getByRole("option", { name: "Alpha" })).toHaveAttribute("aria-selected", "true");
        const delta = page.getByRole("option", { name: "Delta" });
        await expect(delta).toHaveAttribute("aria-selected", "false");
        await expect(trigger).toHaveAttribute("aria-activedescendant", await delta.getAttribute("id"));
        await page.keyboard.press("Escape"); await expect(source).toHaveValue("a"); expect(await page.evaluate(() => window.__controlChanges)).toBe(0);
        await trigger.press("End"); await trigger.press("Tab"); await expect(page.locator("#after-select")).toBeFocused(); await expect(source).toHaveValue("e"); expect(await page.evaluate(() => window.__controlChanges)).toBe(1);
        await trigger.press("Home"); await page.locator("#after-select").click(); await expect(source).toHaveValue("e");
        await trigger.evaluate(n => n.setAttribute("data-tip", "使用方向键选择")); await trigger.focus();
        const tooltip = page.getByRole("tooltip"); await expect(tooltip).toBeVisible();
        const id = await tooltip.getAttribute("id"); await expect(trigger).toHaveAttribute("aria-describedby", `select-help ${id}`);
        await trigger.press("ArrowDown"); await trigger.press("Escape"); await expect(tooltip).toHaveCount(0); await expect(trigger).toHaveAttribute("aria-expanded", "true");
        await trigger.press("Escape"); await expect(trigger).toHaveAttribute("aria-expanded", "false");
        await expect(trigger).toHaveAttribute("aria-describedby", "select-help");
    });

    test(`real Layer Viewer and Toastify focus footer and nested locks ${theme}`, async ({ page, context }, info) => {
        await verifyRealFeedback(page, context, theme, info);
    });

    test(`real history selected and hovered rows remain distinct ${theme}`, async ({ page, context }) => {
        await boot(page, context, theme); await page.evaluate(() => window.__jhsBrowserDiagnostics.executeCommand("library.history.open"));
        const row = page.locator(".jhs-history-dialog .tabulator-row").first(); await expect(row).toBeVisible();
        await row.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0); const normal = await styles(row);
        await row.hover(); const hover = await styles(row); expect(hover.background).not.toBe(normal.background);
        await row.locator('input[type="checkbox"]').check(); await page.mouse.move(0, 0); const selected = await styles(row); expect(selected.background).not.toBe(normal.background); expect(selected.outline).toBe("2px");
        await row.hover(); expect((await styles(row)).background).not.toBe(selected.background); await expect(row).toHaveClass(/tabulator-selected/);
    });
}

async function verifyRealFeedback(page, context, theme, info, classic = false) {
        await boot(page, context, theme); await page.emulateMedia({ reducedMotion: "reduce" });
        const original = await page.evaluate(() => {
            document.body.style.paddingRight = "7px"; document.body.style.paddingInlineEnd = "9px";
            const marker = document.createElement("div"); marker.id = "lock-marker"; marker.style.cssText = "width:60%;margin:auto;height:1900px"; document.body.append(marker);
            return { root: document.documentElement.style.cssText, body: document.body.style.cssText, x: marker.getBoundingClientRect().x, scrollbarWidth: innerWidth - document.documentElement.clientWidth };
        });
        if (classic) expect(original.scrollbarWidth).toBeGreaterThan(0);
        await page.evaluate(() => {
            const plugin = window.unsafeWindow.pluginManager.getBean("SettingPlugin"); window.__footerCalls = 0;
            window.__lockDialog = plugin.getRuntimeService("dialog").open({ type: 1, scrollbar: false, anim: -1, area: ["300px", "200px"], title: "锁定弹窗", content: '<div class="jhs-code-viewer">测试内容</div>', btn: ["执行", "取消"], yes: () => { window.__footerCalls++; return false; } });
        });
        const dialog = page.locator(".jhs-dialog").last(), footer = dialog.locator(".layui-layer-btn0");
        await expect(dialog).toBeVisible(); await footer.focus(); await page.keyboard.press("Tab"); await footer.focus(); await expect(footer).toHaveCSS("outline-width", "2px");
        await footer.press("Enter"); await footer.press("Space"); expect(await page.evaluate(() => window.__footerCalls)).toBe(2);
        const footerNormal = await styles(footer); await footer.hover(); expect((await styles(footer)).background).not.toBe(footerNormal.background);
        await page.evaluate(image => window.showImageViewer(image), image); const viewer = page.locator(".jhs-image-viewer.viewer-in"); await expect(viewer).toBeVisible();
        expect(await page.evaluate(() => document.body.style.paddingRight)).toBe("7px");
        expect(Math.abs(await page.locator("#lock-marker").evaluate(n => n.getBoundingClientRect().x) - original.x)).toBeLessThanOrEqual(1);
        const close = viewer.locator(".jhs-image-viewer-close"); await page.keyboard.press("Tab"); await close.focus(); await expect(close).toHaveCSS("outline-width", "2px");
        await page.keyboard.press("Escape"); await expect(viewer).toHaveCount(0); expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
        await page.evaluate(image => window.showImageViewer(image), image); await expect(page.locator(".jhs-image-viewer.viewer-in")).toBeVisible();
        await page.evaluate(() => window.layer.close(window.__lockDialog)); await expect(dialog).toHaveCount(0);
        expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
        await page.keyboard.press("Escape"); await expect(page.locator(".jhs-image-viewer")).toHaveCount(0);
        expect(await page.evaluate(() => ({ root: document.documentElement.style.cssText, body: document.body.style.cssText }))).toEqual({ root: original.root, body: original.body });
        await page.evaluate(() => window.show.error("测试通知", { duration: -1 })); const toastClose = page.locator(".jhs-toast .toast-close"); await toastClose.focus(); await expect(toastClose).toHaveCSS("outline-width", "2px"); await toastClose.press("Space"); await expect(page.locator(".jhs-toast")).toHaveCount(0);
        await info.attach(`scroll-lock-${theme}.json`, { body: JSON.stringify(original), contentType: "application/json" });
}

test("Windows classic scrollbars preserve page position through nested Layer and Viewer", async ({}, info) => {
    test.skip(process.platform !== "win32" || info.project.name !== "desktop-wide", "one isolated headed Windows Edge context owns classic scrollbar validation");
    const browser = await chromium.launch({ channel: "msedge", headless: false, args: ["--force-device-scale-factor=1"] });
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
        const page = await context.newPage();
        await verifyRealFeedback(page, context, "dark", info, true);
    } finally { await browser.close(); }
});

test("native backup file selection cleans temporary inputs and preview cancellation never writes", async ({ page, context }) => {
    await boot(page, context, "dark");
    await page.evaluate(() => {
        const plugin = window.unsafeWindow.pluginManager.getBean("SettingPlugin"), backup = plugin.getFormDependencies().backup;
        window.__pickerWrites = 0;
        backup.importData = backup.createSnapshot = async () => { window.__pickerWrites++; };
        return plugin.openSettingDialog("data-tools-panel");
    });
    await expect(page.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
    const cancelChooser = page.waitForEvent("filechooser"); await page.locator("#importBtn").click();
    await (await cancelChooser).setFiles([]); await expect(page.locator('input[type="file"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__pickerWrites)).toBe(0);
    const chooser = page.waitForEvent("filechooser"); await page.locator("#importBtn").click();
    await (await chooser).setFiles({ name: "synthetic-backup.json", mimeType: "application/json", buffer: Buffer.from("{}") });
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    const preview = page.locator(".jhs-dialog").filter({ has: page.locator(".layui-layer-title", { hasText: "数据差异预览" }) });
    await expect(preview).toBeVisible(); await expect(page.locator(".loading-container")).toHaveCount(0);
    await page.keyboard.press("Escape"); await expect(preview).toHaveCount(0);
    expect(await page.evaluate(() => window.__pickerWrites)).toBe(0);
});
