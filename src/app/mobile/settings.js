// @ts-check
import { App } from "@capacitor/app";
import { FullSettingsSession } from "../../ui/settings/full-settings-session.js";
import { createMediaConnections, MEDIA_LIBRARY_STYLES } from "../../ui/settings/media-connections.js";
import { parseBooleanSetting } from "../../core/feature-helpers.js";
import { saveFile } from "../../platform/android/runtime.js";
import { BUILT_IN_SCREENSHOT_SOURCES } from "../../services/screenshot-sources.js";
import { button, el, input, select, sheet, validHttps } from "./components.js";

const GROUPS = [
    ["display", "显示与浏览"],
    ["media", "媒体与隐私"],
    ["connections", "账号与连接"],
    ["sync", "同步与备份"],
    ["diagnostics", "诊断"],
];

/** @param {HTMLElement} root @param {any} app @param {any} route @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope */
export async function showSettings(root, app, route, scope) {
    const s = app.services;
    const session = new FullSettingsSession(s.settings, { androidTranslateTitle: "yes", androidCatalogLayout: "grid", autoPage: "yes",
        themeMode: "light", enableLoadScreenShot: "yes", enablePreviewVideo: "yes", enableLoadPreviewVideo: "yes", screenshotMode: "auto",
        enable123Offline: true, enable115Offline: false, enable115Match: false, enableSubtitle115Upload: true, offlineProviderMode: "ask" });
    scope.addCleanup(() => { delete route.handleBack; session.dispose(); });
    scope.addCleanup(s.styles.register("android-media-settings", MEDIA_LIBRARY_STYLES));
    const groups = el("nav", null, "settings-group-list");
    groups.setAttribute("aria-label", "设置分组");
    const panel = el("section", null, "settings-mobile-panel");
    const feedback = el("p", null, "settings-feedback");
    feedback.setAttribute("role", "status");
    /** @type {Record<string,HTMLElement>} */ const pages = {};
    /** @type {Record<string,HTMLElement>} */ const summaries = {};
    let group = "";
    let saving = false;
    const dirty = () => session.dirtyKeys().length || session.extraDirtyCount();

    const save = button("保存", () => app.run(scope, async () => {
        if (saving || !dirty()) return;
        const editors = session.captureEditors();
        const prefs = session.capture();
        saving = true;
        update();
        try {
            const errors = await session.saveEditors(editors);
            if (errors.some(error => error.id === "media")) delete prefs.enableMediaLibrary;
            if (Object.keys(prefs).length) {
                await s.settings.patch(prefs);
                session.commit(prefs);
            }
            scope.assertActive();
            feedback.textContent = errors.length ? "部分连接未保存，请检查对应设置" : "已保存";
        } finally {
            session.release();
            saving = false;
            if (!scope.disposed) update();
        }
    }), "primary");
    const footer = el("footer", null, "settings-save");
    footer.append(feedback, save);
    root.append(groups, panel, footer);

    /** @param {string} text @param {HTMLElement} control */
    function field(text, control) {
        const label = el("label", null, "settings-mobile-field");
        label.append(el("span", text), control);
        return label;
    }
    /** @param {string} key @param {string} label @param {string[][]} options */
    function choice(key, label, options) {
        const control = select(options, label);
        const refresh = () => { control.value = String(session.snapshot()[key]); };
        refresh();
        scope.listen(session, "settings.changed", refresh);
        control.onchange = () => { void session.set(key, control.value); };
        return field(label, control);
    }
    /** @param {string} key @param {string} label */
    function toggle(key, label) {
        const control = input("checkbox", label);
        control.classList.add("jhs-switch");
        control.setAttribute("role", "switch");
        const refresh = () => { control.checked = parseBooleanSetting(session.snapshot()[key], true); };
        refresh();
        scope.listen(session, "settings.changed", refresh);
        control.onchange = () => { void session.set(key, control.checked ? "yes" : "no"); };
        return field(label, control);
    }

    function update() {
        save.disabled = saving || !dirty();
        const settings = session.snapshot();
        summaries.display.textContent = [
            parseBooleanSetting(settings.androidTranslateTitle, true) ? "Google 简中" : "原标题",
            settings.androidCatalogLayout === "list" ? "列表" : "海报墙",
        ].join(" · ");
        summaries.media.textContent = parseBooleanSetting(settings.enablePreviewVideo, true) ? "预告开启" : "预告关闭";
    }
    /** @param {string} key */
    function showGroup(key) {
        group = key;
        groups.hidden = Boolean(group);
        panel.hidden = !group;
        for (const [id, page] of Object.entries(pages)) page.hidden = id !== key;
        window.scrollTo(0, 0);
        (group ? pages[group]?.querySelector("h2") : groups.querySelector("button"))?.scrollIntoView({ block: "nearest" });
    }
    function confirmExit() {
        const dialog = sheet(root, "有未保存的设置", scope, false);
        const actions = el("div", null, "actions sheet-actions");
        const keep = button("继续编辑", () => dialog.close(), "primary");
        keep.autofocus = true;
        const discard = button("放弃更改", () => { dialog.close(); app.leaveSettings(); }, "quiet-action");
        actions.append(discard, keep);
        dialog.append(actions);
        dialog.addEventListener("close", () => dialog.remove(), { once: true });
        dialog.showModal();
    }
    route.handleBack = () => {
        if (saving) return true;
        if (group) { showGroup(""); return true; }
        if (!dirty()) return false;
        confirmExit();
        return true;
    };

    for (const [id, label] of GROUPS) {
        const page = el("section");
        page.append(el("h2", label, "catalog-heading"));
        panel.append(page);
        pages[id] = page;
        const open = button("", () => { showGroup(id); void app.run(scope, () => hydrate(id)); }, "settings-link");
        const summary = el("small");
        summaries[id] = summary;
        const labels = el("span");
        labels.append(el("strong", label), summary);
        const arrow = el("span", "›");
        arrow.setAttribute("aria-hidden", "true");
        open.append(labels, arrow);
        groups.append(open);
    }
    scope.listen(session, "settings.changed", update);
    update();
    showGroup("");
    pages.display.append(toggle("androidTranslateTitle", "标题翻译"),
        choice("androidCatalogLayout", "作品视图", [["grid", "海报墙"], ["list", "列表"]]),
        choice("themeMode", "主题", [["auto", "跟随系统"], ["light", "浅色"], ["dark", "深色"]]),
        toggle("autoPage", "自动加载下一页"),
        toggle("enableCheckNewVideo", "自动检查收藏演员的新作"));
    const media = pages.media;
    media.append(toggle("enablePreviewVideo", "自动查找预告"),
        toggle("enableLoadPreviewVideo", "查找 DMM 高清预告"),
        toggle("enableLoadScreenShot", "查找长缩略图"),
        choice("screenshotMode", "长缩略图来源", [["auto", "自动"], ["manual", "手动选择"]]));
    for (const provider of BUILT_IN_SCREENSHOT_SOURCES.filter(source => source.implemented)) {
        const control = input("checkbox", provider.name);
        control.setAttribute("role", "switch");
        const refresh = () => {
            const current = s.screenshot.getScreenshotSettings(session.snapshot()).providers.find((/** @type {any} */ item) => item.id === provider.id);
            control.checked = current?.enabled ?? provider.enabled;
        };
        refresh();
        scope.listen(session, "settings.changed", refresh);
        control.onchange = () => {
            const providers = s.screenshot.getScreenshotSettings(session.snapshot()).providers;
            const override = providers.find((/** @type {any} */ item) => item.id === provider.id);
            const next = { ...override, id: provider.id, enabled: control.checked };
            void session.set("screenshotProviders", JSON.stringify([...providers.filter((/** @type {any} */ item) => item.id !== provider.id), next]));
        };
        media.append(field(provider.name, control));
    }
    const privacy = button("隐私遮罩", () => app.run(scope, () => app.command("privacy.toggle")), "settings-link");
    const updatePrivacy = () => privacy.setAttribute("aria-pressed", String(s.privacy.active && s.privacy.enabled));
    updatePrivacy();
    scope.listen(s.privacy, "privacy.changed", updatePrivacy);
    media.append(privacy);

    const connections = pages.connections;
    const accountStatus = new Map();
    for (const [id, title] of [["javdb", "JavDB"], ["one115", "115"], ["pan123", "123 云盘"]]) {
        const status = el("small", "核对账号");
        accountStatus.set(id, status);
        const login = button("登录", () => app.run(scope, async () => {
            if (await app.login(id)) await refreshAccount(id);
        }), "quiet-action");
        const text = el("span", title);
        text.append(status);
        const row = el("div", null, "settings-mobile-field");
        row.append(text, login);
        connections.append(row);
    }
    const servers = el("div");
    connections.append(el("h3", "云盘与字幕"), toggle("enable123Offline", "123 云盘离线"), toggle("enable115Offline", "115 离线"),
        choice("offlineProviderMode", "默认离线服务", [["ask", "每次询问"], ["123", "优先 123"], ["115", "优先 115"]]),
        toggle("enable115Match", "115 文件匹配"), toggle("enableSubtitle115Upload", "115 字幕直传"), el("h3", "Emby / Jellyfin"), servers);
    /** @param {string} id */
    async function refreshAccount(id) {
        const status = accountStatus.get(id);
        status.textContent = "正在核对…";
        try {
            const identity = id === "javdb" ? (await s.javdbLists.access(scope)).account :
                id === "pan123" ? await s.pan123Credential.getStoredToken() :
                    await s.offline.getAccountIdentity("one115", { scope });
            if (!scope.disposed) status.textContent = identity ? "已连接" : "未连接";
        } catch (error) {
            if (!scope.disposed) status.textContent = /** @type {{code?:string}} */ (error).code === "AUTH_REQUIRED" ? "未连接" : "暂时无法核对";
        }
    }

    const sync = pages.sync;
    const davFields = el("fieldset", null, "settings-profile");
    davFields.disabled = true;
    const davUrl = input("url", "服务地址");
    const davUser = input("text", "用户名");
    const davPassword = input("password", "密码");
    const syncState = el("p", null, "settings-inline-status");
    syncState.setAttribute("role", "status");
    const readDav = () => ({ url: davUrl.value.trim(), username: davUser.value, password: davPassword.value });
    /** @param {ReturnType<typeof readDav>} config */
    function davOrigin(config) {
        if (!config.url && !config.username && !config.password) return null;
        const url = validHttps(config.url);
        if (!url || !config.username || !config.password) throw new Error("填写 HTTPS 地址、用户名和密码");
        return new URL(url).origin;
    }
    async function refreshSync() {
        if (davFields.disabled) return;
        const status = await s.webdavSync.getStatus();
        if (!scope.disposed) {
            syncState.textContent = status.message || (status.configured ? "已连接" : "未连接");
            summaries.sync.textContent = status.configured ? "WebDAV 已连接" : "WebDAV 未连接";
            syncNow.disabled = restoreVersion.disabled = !status.configured;
        }
    }
    scope.listen(s.webdavSync, "status", refreshSync);
    const syncButtons = el("div", null, "actions");
    syncButtons.append(button("测试连接", () => app.run(scope, async () => {
        const config = readDav(), origin = davOrigin(config);
        if (!origin) throw new Error("先填写 WebDAV 连接");
        const owner = "android:dav-test:" + crypto.randomUUID();
        s.urlPolicy.setLocalOriginOwner(owner, [origin]);
        try {
            await s.webdav.createClient(config, { scope }).request("PROPFIND", "", { Depth: "0" });
            scope.assertActive();
            syncState.textContent = "连接测试通过";
        } finally { s.urlPolicy.setLocalOriginOwner(owner, []); }
    }), "quiet-action"));
    const syncNow = button("立即同步", () => app.run(scope, async () => {
        await s.webdavSync.retry();
        await refreshSync();
    }), "quiet-action");
    syncNow.disabled = true;
    syncButtons.append(syncNow);
    const files = el("input");
    files.type = "file";
    files.accept = "application/json,.json";
    files.hidden = true;
    files.onchange = () => void app.run(scope, async () => {
        const file = files.files?.[0];
        files.value = "";
        if (!file) return;
        const parsed = JSON.parse(await file.text());
        scope.assertActive();
        const dialog = sheet(root, "导入本地备份", scope);
        dialog.append(el("p", "导入会应用备份中的作品库与偏好。"), button("确认导入", () => app.run(scope, async () => {
            dialog.close();
            await s.backup.importData(parsed, { signal: scope.signal, assertActive: () => scope.assertActive() });
            await s.settings.refresh();
            feedback.textContent = "备份已导入";
        }), "primary"));
        dialog.showModal();
    });
    const backup = el("div", null, "actions");
    backup.append(button("导出备份", () => app.run(scope, async () => {
        const data = await s.backup.exportData();
        scope.assertActive();
        await saveFile(JSON.stringify(data), "JHS-备份.json", "application/json");
    }), "quiet-action"), button("导入备份", () => files.click(), "quiet-action"));
    const restoreVersion = button("恢复历史版本", () => app.run(scope, async () => {
        const versions = await s.webdavSync.listRecoveryFiles(scope);
        scope.assertActive();
        const dialog = sheet(root, "恢复历史版本", scope);
        if (!versions.length) dialog.append(el("p", "暂无历史版本"));
        else {
            const fields = select(versions.map((/** @type {any} */ version) => [version.name, version.name]), "备份版本");
            dialog.append(fields, button("恢复所选版本", () => app.run(scope, async () => {
                if (!fields.value) return;
                await s.webdavSync.restore(fields.value, false, scope);
                dialog.close();
                feedback.textContent = "版本已恢复";
            }), "primary"));
        }
        dialog.showModal();
    }), "quiet-action");
    restoreVersion.disabled = true;
    backup.append(restoreVersion);
    davFields.append(syncState, field("服务地址", davUrl), field("用户名", davUser), field("密码", davPassword), syncButtons);
    sync.append(davFields, el("h3", "备份与恢复"), backup, files);

    const version = el("p");
    pages.diagnostics.append(version, button("导出诊断", () => app.run(scope, () =>
        saveFile(JSON.stringify(s.diagnostics.exportSnapshot(), null, 2), "JHS-诊断.json", "application/json")), "quiet-action"));
    const loaded = new Set();
    /** @param {string} key */
    async function hydrate(key) {
        if (loaded.has(key)) return;
        loaded.add(key);
        try {
            if (key === "connections") {
                void Promise.all([...accountStatus.keys()].map(id => refreshAccount(id)));
                const saved = await s.mediaLibrary.getConfiguration();
                scope.assertActive();
                summaries[key].textContent = saved.connections.length ? `${saved.connections.length} 台媒体服务器` : "JavDB、云盘与媒体库";
                const editor = createMediaConnections({ document, scope, connections: saved.connections, enabled: s.mediaLibrary.enabled(), embedded: true, requireHttps: true,
                    onSave: async () => {}, onTest: (config, owner) => s.mediaLibrary.testConnection(config, owner),
                    bindDraft: draft => {
                        session.registerEditor("media", { capture: draft.capture, validate: draft.validate, error: () => {},
                            save: async (/** @type {any[]} */ values) => {
                                await s.mediaLibrary.saveConnections(values, saved.revision);
                                saved.revision = (await s.mediaLibrary.getConfiguration()).revision;
                            } });
                        scope.listen(servers, "change", () => { void session.set("enableMediaLibrary", draft.enabled()); });
                    } });
                servers.replaceChildren(editor);
                scope.listen(servers, "input", update);
                scope.observe(servers, update, { childList: true, subtree: true });
            } else if (key === "sync") {
                syncState.textContent = "正在读取连接设置…";
                const saved = await s.webdav.getProfile().catch((/** @type {{code?:string}} */ error) => {
                    if (error.code !== "WEBDAV_CREDENTIAL_UNREADABLE") throw error;
                    syncState.textContent = "请重新输入 WebDAV 密码";
                    const current = s.settings.snapshot();
                    return { url: current.webDavUrl || "", username: current.webDavUsername || "", password: "" };
                });
                scope.assertActive();
                davUrl.value = saved.url;
                davUser.value = saved.username;
                davPassword.value = saved.password;
                session.registerEditor("webdav", { capture: readDav, validate: davOrigin,
                    error: (/** @type {Error} */ error) => { syncState.textContent = error.message; },
                    save: async (/** @type {ReturnType<typeof readDav>} */ config) => {
                        const origin = davOrigin(config);
                        await s.webdav.saveProfile(config, (/** @type {Record<string,any>} */ next) => {
                            if (origin) next.trustedLocalOrigins = [...new Set([...(next.trustedLocalOrigins ?? []), origin])];
                        });
                        await refreshSync();
                    } });
                scope.listen(sync, "input", update);
                davFields.disabled = false;
                await refreshSync();
            } else if (key === "diagnostics") {
                const info = await App.getInfo();
                scope.assertActive();
                version.textContent = `JHS ${info.version} · 构建 ${info.build}`;
            }
        } catch (error) {
            loaded.delete(key);
            if (key === "sync" && davFields.disabled && !scope.disposed) syncState.textContent = "无法读取连接设置，请返回后重试";
            throw error;
        }
    }
    summaries.connections.textContent = "JavDB、云盘与媒体库";
    void s.webdavSync.getStatus().then((/** @type {any} */ status) => {
        if (!scope.disposed) summaries.sync.textContent = status.configured ? "WebDAV 已连接" : "WebDAV 未连接";
    }).catch(() => { if (!scope.disposed) summaries.sync.textContent = "WebDAV 状态读取失败"; });
    if (route.section) {
        showGroup(route.section);
        await hydrate(route.section);
    }
}
