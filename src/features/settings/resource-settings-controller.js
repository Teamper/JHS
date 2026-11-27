// @ts-check

import { PRODUCT_NAMES } from "../../core/product-names.js";
import { escapeHtml } from "../../core/constants.js";
import { JhsSelect } from "../../core/ui-primitives.js";
import { BUILT_IN_NATIVE_MAGNET_SOURCES, buildCustomMagnetSource, validateRule } from "../../services/resource-settings-service.js";
import { BUILT_IN_SCREENSHOT_SOURCES } from "../../services/screenshot-sources.js";
import { bindSettingRows, enhanceSettingRows, renderSettingRow } from "../../ui/settings/setting-control-renderer.js";
import { JhsError } from "../../core/jhs-error.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";

/** @typedef {import("./settings-controller.js").SettingPlugin} SettingPlugin */
/** @typedef {import("./settings-controller.js").ResourceRecord} ResourceRecord */
/** @typedef {import("./settings-controller.js").JQueryEvent} JQueryEvent */
/** @typedef {import("./settings-controller.js").JQueryInputEvent} JQueryInputEvent */
/** @typedef {import("./settings-controller.js").JQueryHandle} JQueryHandle */

/** @param {SettingPlugin} owner */
export async function loadResourceSettings(owner, /** @type {any} */ layerRoot = null, generation = owner._settingsDialogGeneration) {
    const resources = owner.fullResources;
    const root = layerRoot ? owner.jquery(layerRoot) : owner.jquery(owner.document);
    const custom = resources.getMagnetSources(), tags = resources.getMagnetTagRules(), filters = resources.getMagnetFilterRules();
    const builtInOverrides = resources.getBuiltInSources(), screenshot = resources.getScreenshotSettings(), cloud = resources.getCloudSettings();
    if (layerRoot && (!root[0]?.isConnected || generation !== owner._settingsDialogGeneration)) return;
    const builtInCatalog = [...BUILT_IN_NATIVE_MAGNET_SOURCES, ...owner.getRuntimeService("magnet").getBuiltInSources()];
    owner.resourceState = { custom, tags, filters, builtIn: builtInCatalog.map((source => ({ ...source, ...(builtInOverrides.find((item => item.id === source.id)) || {}) }))), screenshot: { mode: String(screenshot.mode), providers: BUILT_IN_SCREENSHOT_SOURCES.map((source => { const merged = { ...source, ...(screenshot.providers.find((item => item.id === source.id)) || {}) }; return false === source.implemented ? { ...merged, enabled: false } : merged; })) } };
    owner.renderResourceSettings(root);
    owner.renderCloudSettings(root, cloud);
    root.find("#resource-sources-panel").off("change.jhsResource", 'input[name="screenshotMode"]').on("change.jhsResource", 'input[name="screenshotMode"]', ((/** @type {JQueryInputEvent} */ event) => {
        const previous = owner.resourceState.screenshot.mode;
        owner.resourceState.screenshot.mode = event.currentTarget.value;
        void resources.saveScreenshotMode(owner.resourceState.screenshot.mode).catch((error) => {
            owner.resourceState.screenshot.mode = previous;
            root.find(`input[name="screenshotMode"][value="${previous}"]`).prop("checked", true);
            owner.logger.error("截图模式保存失败", error), owner.notifications.error("截图模式保存失败，已恢复");
        });
    }));
    root.find("#add-custom-magnet-source").off("click.jhsResource").on("click.jhsResource", (() => owner.openSourceDialog(null, root)));
    root.find("#add-magnet-tag-rule").off("click.jhsResource").on("click.jhsResource", (() => owner.openRuleDialog("tag", null, root)));
    root.find("#add-magnet-filter-rule").off("click.jhsResource").on("click.jhsResource", (() => owner.openRuleDialog("filter", null, root)));
    root.find("#export-resource-config").off("click.jhsResource").on("click.jhsResource", (async () => {
        const text = JSON.stringify(resources.exportConfig(), null, 2);
        root.find("#advanced-resource-json").val(text).prop("readonly", true);
        root.data("jhsSettingsDraft")?.commitPending("#advanced-resource-json", text);
    }));
    root.find("#edit-resource-config").off("click.jhsResource").on("click.jhsResource", (() => root.find("#advanced-resource-json").prop("readonly", false).trigger("focus")));
    root.find("#import-resource-config").off("click.jhsResource").on("click.jhsResource", (async () => {
        try {
            const submitted = String(root.find("#advanced-resource-json").val() || "");
            await resources.importConfig(submitted);
            root.data("jhsSettingsDraft")?.commitPending("#advanced-resource-json", submitted);

            await owner.loadResourceSettings(root, generation);
            JhsSelect.refreshAll();
        } catch (error) { owner.logger?.error?.("资源设置操作失败", error), owner.notifications.error(error instanceof TypeError || error instanceof JhsError ? error.message : "资源设置保存失败，请重试"); }
    }));
    root.find("#car-number-import,#car-number-import-status").off("input.jhsResource change.jhsResource").on("input.jhsResource change.jhsResource", (() => {
        owner.pendingCarImport = null;
        owner._carImportRevision++;
        const result = root.find("#car-number-import-preview");
        if (!result.prop("hidden")) root.find("#car-number-import-help").text("内容已修改，请重新解析");
        result.empty().prop("hidden", true);
        root.find("#confirm-car-number-import").prop("disabled", true).text("导入记录");
    }));
    root.find("#check-one-one-five-login").off("click.jhsResource").on("click.jhsResource", (() => owner.checkOneOneFiveLogin(root)));
}

/** Render cloud controls from the canonical settings catalog and bind them to SettingsService. */
    /** @param {JQueryHandle} root @param {Record<string, any>} cloud
 * @param {SettingPlugin} owner
 */
export function renderCloudSettings(owner, root, cloud) {
    const host = root.find("#cloud-settings-catalog");
    if (!host.length) return;
    const registry = owner.getRuntimeService("settingsRegistry"), settings = owner.fullSettings;
    const descriptors = registry.list({ surfaces: [ "full" ] }).filter((/** @type {any} */ descriptor) => descriptor.section === "cloud");
    if (owner._cloudSettingBinding && host.find("[data-jhs-setting]").length) {
        owner._cloudSettingBinding.sync(settings.snapshot());
        return;
    }
    host.empty();
    const groups = new Map();
    for (const [key,title] of [["general","通用设置"],["123","123 云盘"],["115","115"]]) {
        const group = owner.jquery('<section class="jhs-setting-section jhs-cloud-section"></section>').attr("data-jhs-cloud-group", key);
        group.append(owner.jquery('<header class="jhs-setting-section__header"></header>').append(owner.jquery("<h4></h4>").text(title)));
        if (key === "115") group.append(owner.jquery('<div class="jhs-toolbar"></div>').append(owner.jquery("<span></span>").text("登录状态：").append(owner.jquery('<span id="one-one-five-state" class="jhs-badge" role="status"></span>').text("未知")), '<button type="button" id="check-one-one-five-login" class="jhs-btn jhs-btn--secondary">检测登录</button>'));
        host.append(group); groups.set(key,group);
    }
    const valueFor = (/** @type {string} */ key) => key === "offlineProviderMode" ? cloud.providerMode : key === "oneOneFiveConcurrency" ? cloud.concurrency : key === "oneOneFiveCacheMinutes" ? cloud.cacheMinutes : cloud[key];
    descriptors.forEach((/** @type {any} */ descriptor) => {
        const rendered = renderSettingRow(descriptor, { jquery: owner.jquery, deferred: true, value: valueFor(descriptor.key) });
        rendered.root.attr("id", descriptor.key);
        groups.get(descriptor.key === "offlineProviderMode" ? "general" : descriptor.key === "enable123Offline" ? "123" : "115").append(rendered.row);
    });
    owner._cloudSettingBinding = bindSettingRows(host, descriptors, { settings, onWriteError: () => owner.notifications.error("设置保存失败，已恢复原设置") });
    host.find("#check-one-one-five-login").on("click.jhsResource", () => owner.checkOneOneFiveLogin(root));
}

/** @param {SettingPlugin} owner */
export function renderResourceSettings(owner, root = owner.jquery(owner.document)) {
    if (!root[0]?.isConnected || root.data("jhsSettingsGeneration") != null && root.data("jhsSettingsGeneration") !== owner._settingsDialogGeneration) return;
    const resources = owner.fullResources;
    owner.cancelResourceTests();
    const renderGeneration = ++owner._sourceRenderGeneration;
    const card = (/** @type {ResourceRecord} */ source, /** @type {boolean} */ custom, /** @type {"magnet" | "screenshot"} */ kind) => {
        const node = owner.jquery('<article class="jhs-card jhs-resource-card"></article>');
        const defaultType = "magnet" === kind ? "磁力来源" : "截图来源";
        node.append(owner.jquery('<div class="jhs-setting-row jhs-setting-row--action"></div>').append(owner.jquery('<div></div>').append(owner.jquery("<strong></strong>").text(source.name), source.experimental ? '<span class="jhs-badge">实验性</span>' : "", owner.jquery("<small></small>").text(`${source.type || defaultType} · ${source.domain || (() => { try { return new URL(source.searchUrlTemplate).hostname; } catch { return "未配置域名"; } })()}${custom ? " · 优先级 " + source.priority : ""}`)), owner.jquery('<input type="checkbox" class="jhs-switch jhs-source-toggle" role="switch">').prop("checked", source.enabled)));
        const actions = owner.jquery('<div class="jhs-toolbar"></div>').append('<button type="button" class="jhs-btn jhs-btn--secondary jhs-source-test">测试</button>');
        if (custom) actions.append('<button type="button" class="jhs-btn jhs-btn--secondary jhs-source-edit">编辑</button><button type="button" class="jhs-btn jhs-btn--danger jhs-source-delete">删除</button>');
        if (!custom && source.implemented !== false) {
            const priority = owner.jquery('<input type="number" class="jhs-field jhs-source-priority" min="1" step="1">')
                .val(source.priority).attr("aria-label", "优先级 " + source.name);
            actions.prepend(owner.jquery('<label class="jhs-source-priority-label"></label>').text("优先级").append(priority));
            priority.on("change", async () => {
                const value = Number(priority.val());
                if (!Number.isSafeInteger(value) || value < 1) { priority.val(source.priority); return; }
                try {
                    await resources.updateArray(kind === "screenshot" ? "screenshotProviders" : "magnetBuiltInSources", (list) => {
                        const found = list.find(item => item.id === source.id);
                        if (found) found.priority = value;
                        else list.push({ id: source.id, priority: value });
                        return list;
                    });
                    source.priority = value;
                } catch (error) {
                    priority.val(source.priority);
                    owner.logger.error("保存来源优先级失败", error);
                    owner.notifications.error("优先级保存失败");
                }
            });
        }
        const row = node.children(".jhs-setting-row"), toggle = row.children("input").attr("aria-label", `启用 ${source.name}`);
        actions.prepend(toggle).addClass("jhs-setting-row__control"); row.append(actions);
        node.on("change", ".jhs-source-toggle", async (/** @type {JQueryInputEvent} */ event) => {
            const previous = !event.currentTarget.checked;
            source.enabled = event.currentTarget.checked;
            try {
                if ("screenshot" === kind) {
                    await resources.updateArray("screenshotProviders", (list) => {
                        const found = list.find((item => item.id === source.id));
                        if (found) found.enabled = source.enabled;
                        else list.push({ id: source.id, enabled: source.enabled });
                        return list;
                    });
                } else if (custom) {
                    await resources.updateArray("customMagnetSources", (list) => {
                        const found = list.find((item => item.id === source.id));
                        if (found) found.enabled = source.enabled;
                        return list;
                    });
                } else {
                    await resources.updateArray("magnetBuiltInSources", (list) => {
                        const found = list.find((item => item.id === source.id));
                        if (found) found.enabled = source.enabled;
                        else list.push({ id: source.id, enabled: source.enabled });
                        return list;
                    });
                }
                owner.renderResourceSettings(root);
            } catch (error) {
                source.enabled = previous;
                owner.jquery(event.currentTarget).prop("checked", previous);
                owner.logger.error("来源设置保存失败", error), owner.notifications.error("来源设置保存失败，已恢复");
            }
        });
        node.on("click", ".jhs-source-test", (/** @type {JQueryEvent} */ event) => {
            const url = source.testMode === "host-page" ? null : source.testUrl || source.baseUrl || source.searchUrlTemplate?.replace("{keyword}", "test");
            void owner.testSource(event.currentTarget, url, { custom, source, renderGeneration });
        });
        custom && node.on("click", ".jhs-source-edit", (() => owner.openSourceDialog(source, root))).on("click", ".jhs-source-delete", ((/** @type {JQueryEvent} */ event) => owner.utils.q(event, `删除来源“${escapeHtml(source.name)}”？`, (async () => {
            try {
                await resources.updateArray("customMagnetSources", (list) => list.filter((item => item.id !== source.id)));
                const custom = resources.getMagnetSources();
                if (root && (!owner.jquery(root)[0]?.isConnected || resources !== owner.fullResources)) return;
                owner.resourceState.custom = custom;
                owner.renderResourceSettings(root);
            } catch (error) { owner.logger?.error?.("资源设置操作失败", error), owner.notifications.error(error instanceof TypeError || error instanceof JhsError ? error.message : "资源设置保存失败，请重试"); }
        }), null, { confirmText: "删除", cancelText: "取消", tone: "danger" })));
        return node;
    };
    root.find("#builtin-magnet-source-list").empty().append(owner.resourceState.builtIn.map((source => card(source, false, "magnet"))));
    root.find("#custom-magnet-source-list").empty().append(owner.resourceState.custom.length ? owner.resourceState.custom.map((source => card(source, true, "magnet"))) : '<p class="jhs-setting-help">暂无自定义来源</p>');
    root.find("#screenshot-source-list").empty().append(owner.resourceState.screenshot.providers.map((source => card(source, false, "screenshot"))));
    owner.resourceState.screenshot.providers.forEach(((source, index) => {
        if (false === source.implemented) root.find("#screenshot-source-list .jhs-resource-card").eq(index).find(".jhs-source-toggle").prop("disabled", true).end().find("strong").after('<span class="jhs-badge">未实现</span>').end().find(".jhs-source-test").remove();
    }));
    root.find(`input[name="screenshotMode"][value="${owner.resourceState.screenshot.mode}"]`).prop("checked", true);
    owner.renderRules("tag", root);
    owner.renderRules("filter", root);
}

/** @param {SettingPlugin} owner */
export function renderRules(owner, /** @type {"tag" | "filter"} */ kind, root = owner.jquery(owner.document)) {
    const resources = owner.fullResources;
    const list = "tag" === kind ? owner.resourceState.tags : owner.resourceState.filters, host = root.find("#magnet-" + kind + "-rule-list").empty();
    if (!list.length) host.append('<p class="jhs-setting-help">暂无规则</p>');
    list.forEach((rule => {
        const node = owner.jquery('<article class="jhs-card jhs-record-card"></article>').append(owner.jquery("<strong></strong>").text(rule.name), owner.jquery("<p></p>").text(`${"regex" === rule.type ? "正则" : "包含"}：${rule.pattern}${"tag" === kind ? ` · 权重 ${Number(rule.weight) >= 0 ? "+" : ""}${rule.weight || 0}` : ` · ${"hide" === rule.action ? "隐藏" : `降权 ${rule.penalty || -20}`}`}`), '<div class="jhs-toolbar"><button type="button" class="jhs-btn jhs-btn--secondary jhs-rule-edit">编辑</button><button type="button" class="jhs-btn jhs-btn--danger jhs-rule-delete">删除</button></div>');
        node.on("click", ".jhs-rule-edit", (() => owner.openRuleDialog(kind, rule, root))).on("click", ".jhs-rule-delete", ((/** @type {JQueryEvent} */ event) => owner.utils.q(event, `删除规则“${escapeHtml(rule.name)}”？`, (async () => {
            try {
                await resources.updateArray("tag" === kind ? "magnetTagRules" : "magnetFilterRules", (list) => list.filter((item => item.id !== rule.id)));
                const rules = await resources.getArray("tag" === kind ? "magnetTagRules" : "magnetFilterRules");
                if (root && (!owner.jquery(root)[0]?.isConnected || resources !== owner.fullResources)) return;
                owner.resourceState["tag" === kind ? "tags" : "filters"] = rules;
                owner.renderRules(kind, root);
            } catch (error) { owner.logger?.error?.("资源设置操作失败", error), owner.notifications.error(error instanceof TypeError || error instanceof JhsError ? error.message : "资源设置保存失败，请重试"); }
        }), null, { confirmText: "删除", cancelText: "取消", tone: "danger" })));
        host.append(node);
    }));
}

/** @param {SettingPlugin} owner */
export function openSourceDialog(owner, /** @type {ResourceRecord | null} */ existing = null, /** @type {any} */ root = null) {
    const resources = owner.fullResources;
    const dialog = owner.getRuntimeService("dialog"), fields = ["rowSelector","titleSelector","magnetSelector","sizeSelector","dateSelector","seedersSelector","leechersSelector","resultsPath","titlePath","magnetPath","hashPath","sizePath","datePath","seedersPath"];
    const fieldLabels = { rowSelector: "结果行选择器", titleSelector: "标题选择器", magnetSelector: "磁力选择器", sizeSelector: "大小选择器", dateSelector: "日期选择器", seedersSelector: "做种数选择器", leechersSelector: "下载数选择器", resultsPath: "结果列表路径", titlePath: "标题字段路径", magnetPath: "磁力字段路径", hashPath: "哈希字段路径", sizePath: "大小字段路径", datePath: "日期字段路径", seedersPath: "做种数字段路径" };
    const content = owner.jquery(`<div class="jhs-setting-section jhs-resource-form jhs-scrollbar"><label>名称<input name="name" class="jhs-field"></label><label>开启<input name="enabled" type="checkbox" class="jhs-switch" role="switch"></label><label>优先级<input name="priority" type="number" class="jhs-field" min="1"></label><label>搜索地址模板<input name="searchUrlTemplate" class="jhs-field"></label><label>原网页地址模板<input name="targetUrlTemplate" class="jhs-field"></label><label>解析类型<select name="parserType" class="jhs-select-source"><option value="magnet-links">自动寻找磁力链接</option><option value="torrent-table">表格或列表页面</option><option value="json">${PRODUCT_NAMES.json} 接口</option></select></label><div class="jhs-parser-fields"></div></div>`);
    const renderFields = () => {
        const type = content.find('[name="parserType"]').val(), names = "torrent-table" === type ? fields.slice(0, 7) : "json" === type ? fields.slice(7) : [];
        content.find(".jhs-parser-fields").html(names.map((name => `<label>${fieldLabels[/** @type {keyof typeof fieldLabels} */ (name)]}<input name="${name}" class="jhs-field"></label>`)).join(""));
        names.forEach((name => content.find(`[name="${name}"]`).val(existing?.[name] || "")));
        enhanceSettingRows(content[0]);
        JhsSelect.enhance(content);
    };
    Object.entries(existing || { enabled: true, priority: 100, parserType: "magnet-links" }).forEach(([key, value]) => {
        const input = content.find(`[name="${key}"]`);
        "checkbox" === input.attr("type") ? input.prop("checked", value) : input.val(value);
    });
    content.on("change", '[name="parserType"]', renderFields), renderFields(), content.appendTo("body").hide();
    let saving = false;
    /** @type {(() => void) | undefined} */ let releaseOwner;
    const editorId = dialog.open({ type: 1, title: existing ? "编辑自定义磁力源" : "添加自定义磁力源", content, skin: "jhs-confirm-actions", ui: { size: "md", body: "scroll" }, btn: ["取消", "保存"], success: () => content.show(), end: () => { releaseOwner?.(); content.remove(); }, btn2: async (/** @type {number} */ index) => {
        if (saving || root && !owner.jquery(root)[0]?.isConnected) return;
        saving = true;
        try {
            const form = Object.fromEntries(Array.from(content.find("input,select"), element => [element.name, "checkbox" === element.type ? element.checked : element.value]));
            const source = buildCustomMagnetSource(form, existing);
            await resources.updateArray("customMagnetSources", (list) => {
                const target = existing ? list.findIndex((item => item.id === existing.id)) : -1;
                if (target >= 0) list.splice(target, 1, source);
                else list.push(source);
                return list;
            });
            const custom = resources.getMagnetSources();
                if (root && (!owner.jquery(root)[0]?.isConnected || resources !== owner.fullResources)) return;
                owner.resourceState.custom = custom;
            dialog.close(index), root && owner.renderResourceSettings(root);
        } catch (error) { owner.logger?.error?.("资源设置操作失败", error), owner.notifications.error(error instanceof TypeError || error instanceof JhsError ? error.message : "资源设置保存失败，请重试"); }
        finally { saving = false; }
    } });
    releaseOwner = owner._settingsDialog?.scope.addCleanup(() => dialog.close(editorId));
}

/** @param {SettingPlugin} owner */
export function openRuleDialog(owner, /** @type {"tag" | "filter"} */ kind, /** @type {ResourceRecord | null} */ existing = null, /** @type {any} */ root = null) {
    const resources = owner.fullResources;
    const dialog = owner.getRuntimeService("dialog"), isTag = "tag" === kind;
    const content = owner.jquery(`<div class="jhs-setting-section jhs-resource-form jhs-rule-form jhs-scrollbar"><label>名称<input name="name" class="jhs-field"></label>${isTag ? "" : '<label>匹配范围<select name="target" class="jhs-select-source"><option value="title">标题</option><option value="file">文件名</option></select></label>'}<label>匹配方式<select name="type" class="jhs-select-source"><option value="contains">包含</option><option value="regex">正则</option></select></label><label>匹配内容<input name="pattern" class="jhs-field"></label>${isTag ? '<label>权重<input name="weight" type="number" class="jhs-field"></label>' : '<label>动作<select name="action" class="jhs-select-source"><option value="hide">隐藏</option><option value="penalty">降权</option></select></label><label>降权分数<input name="penalty" type="number" class="jhs-field"></label>'}<label>开启<input name="enabled" type="checkbox" class="jhs-switch" role="switch"></label></div>`);
    Object.entries(existing || { enabled: true, type: "contains", weight: 0, action: "hide", penalty: -20 }).forEach(([key, value]) => {
        const input = content.find(`[name="${key}"]`);
        "checkbox" === input.attr("type") ? input.prop("checked", value) : input.val(value);
    });
    enhanceSettingRows(content[0]);
    JhsSelect.enhance(content);
    content.appendTo("body").hide();
    let saving = false;
    /** @type {(() => void) | undefined} */ let releaseOwner;
    const editorId = dialog.open({ type: 1, title: `${existing ? "编辑" : "新建"}${isTag ? "标签" : "过滤"}规则`, content, skin: "jhs-confirm-actions", ui: { size: "sm", body: "scroll" }, btn: ["取消", "保存"], success: () => content.show(), end: () => { releaseOwner?.(); content.remove(); }, btn2: async (/** @type {number} */ index) => {
        if (saving || root && !owner.jquery(root)[0]?.isConnected) return;
        saving = true;
        try {
            const rule = Object.fromEntries(Array.from(content.find("input,select"), element => [element.name, "checkbox" === element.type ? element.checked : element.value]));
            rule.id = existing?.id || `rule-${Date.now()}`;
            if (isTag) rule.weight = Number(rule.weight);
            else rule.penalty = Number(rule.penalty);
            validateRule(rule);
            await resources.updateArray(isTag ? "magnetTagRules" : "magnetFilterRules", (list) => {
                const target = existing ? list.findIndex((item => item.id === existing.id)) : -1;
                if (target >= 0) list.splice(target, 1, rule);
                else list.push(rule);
                return list;
            });
            const rules = await resources.getArray(isTag ? "magnetTagRules" : "magnetFilterRules");
            if (root && (!owner.jquery(root)[0]?.isConnected || resources !== owner.fullResources)) return;
            owner.resourceState[isTag ? "tags" : "filters"] = rules;
            dialog.close(index), root && owner.renderRules(kind, root);
        } catch (error) { owner.logger?.error?.("资源设置操作失败", error), owner.notifications.error(error instanceof TypeError || error instanceof JhsError ? error.message : "资源设置保存失败，请重试"); }
        finally { saving = false; }
    } });
    releaseOwner = owner._settingsDialog?.scope.addCleanup(() => dialog.close(editorId));
}

/** @param {SettingPlugin} owner */
export async function checkOneOneFiveLogin(owner, root = owner.jquery(owner.document)) {
    const button = root.find("#check-one-one-five-login");
    if (button.prop("disabled")) return;
    const generation = owner._settingsDialogGeneration;
    const scope = new LifecycleScope(`settings-cloud-login-${generation}`);
    let releaseParent;
    owner._cloudLoginScope?.dispose();
    owner._cloudLoginScope = scope;
    button.prop("disabled", true);
    const isCurrent = () => !scope.disposed && generation === owner._settingsDialogGeneration && button[0]?.isConnected;
    const badge = root.find("#one-one-five-state").text("检测中");
    try {
        const parentScope = await owner.getRuntimeService("scope")?.();
        if (!isCurrent()) return;
        releaseParent = parentScope?.addCleanup?.(() => scope.dispose());
        const result = await owner.getRuntimeService("offline").checkAccount("one115", { scope });
        if (isCurrent()) badge.text(result.authenticated ? "已登录" : "未登录");
    } catch {
        if (isCurrent()) badge.text("检测失败");
    } finally {
        if (isCurrent()) button.prop("disabled", false);
        scope.dispose();
        releaseParent?.();
        if (owner._cloudLoginScope === scope) owner._cloudLoginScope = null;
    }
}

/** @param {SettingPlugin} owner */
export function cancelResourceTests(owner) {
    for (const scope of owner._resourceTestScopes) scope.dispose();
    owner._resourceTestScopes.clear();
}

/** @param {SettingPlugin} owner */
export async function testSource(owner, /** @type {any} */ button, /** @type {string} */ url, /** @type {{source?: ResourceRecord, renderGeneration?: number, custom?: boolean}} */ options = {}) {
    if (!url) return owner.notifications.info(options.source?.testMode === "host-page" ? "此来源使用当前页面" : "请设置来源检测地址");
    const node = owner.jquery(button);
    if (node.prop("disabled")) return;
    const generation = owner._settingsDialogGeneration, renderGeneration = options.renderGeneration ?? owner._sourceRenderGeneration;
    const badge = node.siblings(".jhs-source-test-state").length ? node.siblings(".jhs-source-test-state") : owner.jquery('<span class="jhs-badge jhs-source-test-state"></span>').insertAfter(node);
    const parentScope = await owner.getRuntimeService("scope")?.();
    const scope = new LifecycleScope(`settings-source-test-${options.source?.id || "unknown"}`);
    const releaseParentScope = parentScope?.addCleanup?.(() => scope.dispose());
    owner._resourceTestScopes.add(scope);
    const isCurrent = () => node[0]?.isConnected && generation === owner._settingsDialogGeneration && renderGeneration === owner._sourceRenderGeneration && !scope.disposed;
    node.prop("disabled", true);
    badge.text("检测中");
    try {
        const parsed = new URL(url);
        const response = await owner.getRuntimeService("http").request({
            providerId: `settings-source-${options.source?.id || "unknown"}`, method: "GET", url: parsed.href, responseType: "text", cacheScope: "none",
            urlPolicy: options.custom ? { trustClass: "custom-public" } : { trustClass: "builtin-public", hosts: [options.source?.domain || parsed.hostname] },
        }, scope);
        if (!isCurrent()) return;
        const status = Number(response?.status) || 0, body = response?.data ?? response?.responseText ?? "";
        badge.text(status ? `HTTP ${status} · ${body ? "已响应（未验证解析）" : "空响应"}` : body ? "已响应（未验证解析）" : "空响应");
    } catch (error) {
        if (!isCurrent()) return;
        const status = Number(/** @type {{details?: {status?: number}}} */ (error)?.details?.status ?? /** @type {{status?: number}} */ (error)?.status) || 0;
        badge.text(status === 404 || /** @type {{code?: string}} */ (error)?.code === "NOT_FOUND" ? "404" : status === 429 || /** @type {{code?: string}} */ (error)?.code === "RATE_LIMITED" ? "限流" : [401, 403].includes(status) || /** @type {{code?: string}} */ (error)?.code === "AUTH_REQUIRED" ? "需要授权" : /** @type {{code?: string}} */ (error)?.code === "TIMEOUT" ? "超时" : "请求失败");
    } finally {
        const restoreButton = isCurrent();
        owner._resourceTestScopes.delete(scope);
        releaseParentScope?.();
        scope.dispose();
        if (restoreButton) node.prop("disabled", false).text("测试");
    }
}
