import { test, expect } from "@playwright/test";
import { boot } from "../harness/ui-root-scenes.js";
import { installSharedGmFixture } from "../harness/shared-gm.js";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
import { clickSettingsCategory } from "../harness/settings-navigation.js";

async function open(page, section = "media-connections-panel") {
    await page.evaluate(section => window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog(section), section);
    const dialog = page.locator(".layui-layer").filter({ has: page.locator("#saveBtn") });
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
    return dialog;
}
async function addMedia(dialog) {
    const panel = dialog.locator("#media-connections-panel");
    await panel.getByRole("button", { name: "添加服务器", exact: true }).click();
    await panel.getByLabel("名称", { exact: true }).fill("家庭媒体库");
    await panel.getByLabel("服务器地址（含代理子路径）", { exact: true }).fill("https://media.example.test/");
    await panel.getByLabel("API Key", { exact: true }).fill("fixture-secret");
    return panel;
}
for (const theme of ["light", "dark"]) test(`embedded connection drafts and privacy rows ${theme}`, async ({ page, context }, info) => {
    await boot(page, context, theme);
    const dialog = await open(page);
    const panel = await addMedia(dialog);
    await expect(panel.getByRole("button", { name: "保存连接与启用状态", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.GM_getValue("jhs_media_connections_v1"))).toBeUndefined();
    expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`media-${theme}.png`) });
    await page.keyboard.press("Escape");
    const confirm = page.locator(".layui-layer-dialog").filter({ hasText: "放弃修改" });
    await expect(confirm).toBeVisible();
    await confirm.getByText("继续编辑", { exact: true }).click();
    await dialog.locator("#saveBtn").click();
    await expect(dialog.locator("#saveBtn")).not.toHaveAttribute("aria-busy", "true");
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-dirty-count", "0");
    const stored = await page.evaluate(() => window.GM_getValue("jhs_media_connections_v1"));
    expect(stored).toMatchObject({ schema: 2 });
    expect(JSON.stringify(stored)).not.toContain("fixture-secret");
    await clickSettingsCategory(dialog.locator('[data-panel="appearance-panel"]'));
    await dialog.locator("#privacy-preferences-panel").scrollIntoViewIfNeeded();
    await expect(dialog.getByRole("button", { name: "保存遮罩偏好", exact: true })).toHaveCount(0);
    await expect(dialog.locator('#privacy-preferences-panel input[type="checkbox"]')).toHaveCount(5);
    await page.screenshot({ path: info.outputPath(`privacy-${theme}.png`) });
    const shortcut = dialog.locator("#privacy-preferences-panel input[type=text]");
    await shortcut.focus(); await page.keyboard.press("Control+Shift+P");
    await expect(dialog.locator("#settings-draft-status")).toContainText("未保存");
    await dialog.locator("#saveBtn").click();
    await expect(dialog.locator("#saveBtn")).not.toHaveAttribute("aria-busy", "true");
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-dirty-count", "0");
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
});

test("a failed connection group preserves drafts while ordinary preferences save", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-wide", "one deterministic failure injection");
    await boot(page, context, "light");
    const dialog = await open(page);
    await addMedia(dialog);
    await page.evaluate(() => {
        const service = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("mediaLibrary");
        window.restoreMediaSave = service.saveConnections.bind(service);
        service.saveConnections = async () => { throw new Error("fixture connection failure"); };
    });
    await clickSettingsCategory(dialog.locator('[data-panel="appearance-panel"]'));
    await page.evaluate(() => window.$("#containerColumns").val("8").trigger("input").trigger("change"));
    await dialog.locator("#saveBtn").click();
    await expect(dialog.locator("#saveBtn")).not.toHaveAttribute("aria-busy", "true");
    expect(await page.evaluate(() => window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("settings").snapshot().containerColumns)).toBe(8);
    await expect(dialog.locator("#settings-draft-status")).toContainText("1 项未保存");
    await clickSettingsCategory(dialog.locator('[data-panel="resources-panel"]'));
    await expect(dialog.locator("#media-connections-panel")).toContainText("fixture connection failure");
    await page.evaluate(() => { window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("mediaLibrary").saveConnections = window.restoreMediaSave; });
    await dialog.locator("#saveBtn").click();
    await expect(dialog.locator("#saveBtn")).not.toHaveAttribute("aria-busy", "true");
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-dirty-count", "0");
});

test("stale revisions keep the draft until an explicit reload choice", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-wide", "one deterministic revision conflict");
    await boot(page, context, "light");
    const dialog = await open(page);
    const panel = await addMedia(dialog);
    await page.evaluate(async () => {
        const service = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("mediaLibrary");
        await service.saveConnections([{ id: "external", name: "外部配置", type: "jellyfin", address: "https://external.example/", apiKey: "external-secret", userId: "", enabled: false }], null);
    });
    await dialog.locator("#saveBtn").click();
    await expect(dialog.locator("#saveBtn")).not.toHaveAttribute("aria-busy", "true");
    await expect(panel.getByLabel("名称", { exact: true })).toHaveValue("家庭媒体库");
    await panel.getByRole("button", { name: "重新读取配置", exact: true }).click();
    await expect(panel.getByRole("button", { name: "保留当前草稿", exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "保留当前草稿", exact: true }).click();
    await dialog.locator("#saveBtn").click();
    await expect(dialog.locator("#saveBtn")).not.toHaveAttribute("aria-busy", "true");
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-dirty-count", "0");
    expect(await page.evaluate(async () => (await window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("mediaLibrary").getConfiguration()).connections[0].name)).toBe("家庭媒体库");
});

test("unreadable connection groups stay read-only while healthy preferences save", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-wide", "one unsupported configuration case");
    await boot(page, context, "light");
    await page.evaluate(async () => { await window.credentialService.set("jhs_media_connections_v1", JSON.stringify({ schema: 99, secret: "preserved" })); });
    const before = await page.evaluate(() => window.GM_getValue("jhs_media_connections_v1"));
    const dialog = await open(page);
    await expect(dialog.locator("#media-connections-panel").getByRole("button", { name: "添加服务器", exact: true })).toHaveCount(0);
    await expect(dialog.locator("#media-connections-panel")).toContainText("无效");
    await clickSettingsCategory(dialog.locator('[data-panel="appearance-panel"]'));
    await page.evaluate(() => window.$("#containerColumns").val("8").trigger("input").trigger("change"));
    await dialog.locator("#saveBtn").click();
    await expect(dialog.locator("#saveBtn")).not.toHaveAttribute("aria-busy", "true");
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-dirty-count", "0");
    expect(await page.evaluate(() => window.GM_getValue("jhs_media_connections_v1"))).toEqual(before);
});

test("cross-site concurrent revisions retain both branches and notify both sites", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop-wide", "one cross-origin GM coordination case");
    const shared = await installSharedGmFixture(context);
    await fulfillHostFixtures(context);
    const second = await context.newPage();
    for (const [target, url] of [[page, "https://javdb.com/"], [second, "https://www.javbus.com/"]]) {
        await target.goto(url);
        await injectUserscriptRuntime(target, { beforeUserscriptInjection: target => shared.attach(target), settingOverrides: { enableMediaLibrary: false, translateTitle: "no", enableLoadScreenShot: "no" } });
    }
    let arrivals = 0, release;
    const barrier = new Promise(resolve => { release = resolve; });
    await context.exposeBinding("revisionReadBarrier", async () => { if (++arrivals === 2) release(); await barrier; });
    const submit = (target, name) => target.evaluate(async name => {
        const credential = window.credentialService;
        const original = credential.readVersioned.bind(credential);
        let pending = true;
        credential.readVersioned = async key => {
            const entry = await original(key);
            if (key === "jhs_media_connections_v1" && pending) { pending = false; await window.revisionReadBarrier(); }
            return entry;
        };
        const value = JSON.stringify([{ id: name, name, type: "jellyfin", address: "https://media.example/", apiKey: "shared-secret", userId: "", enabled: false }]);
        try { await credential.setVersioned("jhs_media_connections_v1", value, null); } catch { /* Conflicting branches are inspected below. */ }
    }, name);
    await Promise.all([submit(page, "JavDB"), submit(second, "JavBus")]);
    for (const target of [page, second]) await expect.poll(() => target.evaluate(async () => {
        try { await window.credentialService.readVersioned("jhs_media_connections_v1"); return []; }
        catch (error) { return error.candidates?.map(node => JSON.parse(node.value)[0].name).sort() || []; }
    })).toEqual(["JavBus", "JavDB"]);
    await page.evaluate(async () => {
        try { await window.credentialService.readVersioned("jhs_media_connections_v1"); }
        catch (error) { await window.credentialService.setVersioned("jhs_media_connections_v1", error.candidates[0].value, error.candidates.map(node => node.revision)); }
    });
    await expect.poll(() => second.evaluate(async () => {
        try { return Boolean((await window.credentialService.readVersioned("jhs_media_connections_v1")).revision); }
        catch { return false; }
    })).toBe(true);
    expect([...shared.records].filter(([key]) => key.includes(":revision:")).length).toBe(3);
    expect(JSON.stringify([...shared.records])).not.toContain("shared-secret");
    await second.close();
});

test("media errors identify invalid fields and preserve request failure reasons", async ({ page, context }, info) => {
    await boot(page, context, info.project.name === "mobile" ? "dark" : "light");
    const dialog = await open(page);
    const panel = await addMedia(dialog);
    await page.evaluate(() => {
        const service = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("mediaLibrary");
        window.mediaTestCalls = 0;
        service.testConnection = async () => {
            window.mediaTestCalls++;
            throw Object.assign(new Error("upstream-secret"), window.mediaTestFailure || { code: "TIMEOUT" });
        };
    });
    const name = panel.getByLabel("名称", { exact: true });
    const key = panel.getByLabel("API Key", { exact: true });
    const testConnection = panel.getByRole("button", { name: "测试连接", exact: true });
    await name.fill(""); await testConnection.click();
    await expect(panel).toContainText("请填写服务器名称");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toBeFocused();
    const validationMessage = page.locator(`#${await name.getAttribute("aria-describedby")}`);
    await expect(validationMessage).toBeInViewport();
    expect(await page.evaluate(() => window.mediaTestCalls)).toBe(0);
    await page.screenshot({ path: info.outputPath("media-name-validation.png") });
    await dialog.locator("#saveBtn").click();
    await expect(page.locator(".toastify").filter({ hasText: "请填写服务器名称" })).toBeVisible();
    await name.fill("家庭媒体库"); await expect(name).not.toHaveAttribute("aria-invalid", "true");
    await key.fill(""); await testConnection.click();
    await expect(panel).toContainText("请填写 API Key"); await expect(key).toBeFocused();
    expect(await page.evaluate(() => window.mediaTestCalls)).toBe(0);
    await key.fill("fixture-secret");
    for (const [failure, message] of [
        [{ code: "AUTH_REQUIRED", details: { status: 401 } }, "认证失败（HTTP 401）"],
        [{ code: "AUTH_REQUIRED", details: { status: 403 } }, "服务器拒绝访问（HTTP 403）"],
        [{ code: "TIMEOUT" }, "连接超时"],
        [{ code: "NETWORK_ERROR" }, "网络请求失败"],
    ]) {
        await page.evaluate(failure => { window.mediaTestFailure = failure; }, failure);
        await testConnection.click();
        await expect(panel).toContainText(message);
        await expect(testConnection).not.toHaveAttribute("aria-busy", "true");
        await expect(testConnection).toBeFocused();
    }
    await expect(panel).not.toContainText("upstream-secret");
    expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
});
