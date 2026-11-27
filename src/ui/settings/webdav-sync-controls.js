// @ts-check

import { formatUiDateTime } from "../../core/ui-date-time.js";
import { showDiffPreview } from "./setting-panels.js";
import { JhsSelect } from "../../core/ui-primitives.js";

/** @param {any} root @param {any} dependencies */
export function bindWebDavSyncControls(root, dependencies) {
    /** @type {import("../../contracts/webdav-sync.js").WebDavSync | undefined} */
    const service = dependencies.webdavSync;
    if (!service) return;
    let generation = 0;
    const active = () => !dependencies.scope?.disposed && dependencies.isActive?.() !== false;
    const render = async () => {
        const token = ++generation;
        try {
            const status = await service.getStatus();
            if (!active() || token !== generation) return;
            const parts = [status.busy ? "正在同步…" : status.paused ? "同步已暂停" : status.enabled ? "自动同步已接入" : "尚未接入同步"];
            parts.push("设备 " + (status.replicas ?? 0) + " 台", "待同步 " + (status.pendingChanges ?? 0) + " 项");
            if (status.nextDueAt) parts.push("下次检查 " + formatUiDateTime(status.nextDueAt));
            if (status.legacyRetention && status.retention) parts.push("兼容保留 " + status.retention.count + " 份 / " + status.retention.days + " 天");
            if (status.lastSuccessAt) parts.push(`上次同步：${formatUiDateTime(status.lastSuccessAt)}`);
            if (status.retryAt && status.message) parts.push(`下次重试：${formatUiDateTime(status.retryAt)}`);
            if (status.message) parts.push(status.message);
            if (status.cleanupError) parts.push(status.cleanupError);
            root.find("#jhs-auto-backup-status").text(parts.join("；"));
            root.find("#webdavSyncPauseBtn").text(status.paused ? "恢复本机同步" : "暂停本机同步");
            root.find("#webdavSyncChooseBtn").prop("hidden", !status.profileConflict).toggle(status.profileConflict);
        } catch (error) {
            if (active() && token === generation) {
                dependencies.logger.error("WebDAV 同步状态读取失败", error);
                root.find("#jhs-auto-backup-status").text("同步状态无法读取，请保留本地数据并检查存储");
            }
        }
    };
    /** @param {string} selector @param {() => Promise<void>} action */
    const bind = (selector, action) => root.find(selector).on("click.jhsSync", async (/** @type {any} */ event) => {
        const button = dependencies.jquery(event.currentTarget);
        if (button.prop("disabled")) return;
        button.prop("disabled", true).attr("aria-busy", "true");
        try {
            root.data("jhsSettingsDraft")?.refresh();
            if (["#webdavAutoVerifyBtn", "#webdavSyncChooseBtn", "#webdavSyncHistoryBtn", "#webdavSyncRestoreBtn"].includes(selector) && ["webDavUrl", "webDavUsername", "webDavPassword"].some(key => root.data("jhsDirtyManualKeys")?.has(key))) throw new Error("请先保存连接设置");
            await action();
        }
        catch (error) { if (active()) dependencies.notifications.error(/** @type {Error} */ (error).message); }
        finally { if (active()) { button.prop("disabled", false).removeAttr("aria-busy"); void render(); } }
    });
    bind("#webdavAutoVerifyBtn", async () => {
        if (["webDavSyncKeepCount", "webDavSyncHistoryDays"].some(key => root.data("jhsDirtyManualKeys")?.has(key))) throw new Error("请先保存版本保留设置");
        await service.retry();
    });
    bind("#webdavSyncPauseBtn", async () => { const status = await service.getStatus(); if (active()) await service.pause(!status.paused); });
    bind("#webdavSyncChooseBtn", async () => {
        const shared = dependencies.webdav.sharedProfile;
        const choices = await shared.conflictChoices();
        if (!active()) return;
        const jq = dependencies.jquery, body = jq('<div class="jhs-form-dialog"></div>').hide().appendTo(dependencies.document.body);
        let index = 0, release = () => {};
        for (const choice of choices) {
            const button = jq('<button type="button" class="jhs-btn jhs-btn--secondary"></button>')
                .text((choice.local ? "本站点" : "另一站点") + " · " + choice.url + " · " + choice.username);
            button.on("click", async () => {
                if (!active() || button.prop("disabled")) return;
                body.find("button").prop("disabled", true);
                try {
                    await shared.chooseCandidate(choice.revision);
                    if (!active()) return;
                    dependencies.dialog.close(index);
                    await service.retry();
                } catch (error) { if (active()) { dependencies.notifications.error(/** @type {Error} */ (error).message); body.find("button").prop("disabled", false); } }
            });
            body.append(button);
        }
        index = dependencies.dialog.open({ type: 1, title: "选择共享 WebDAV 连接", content: body, ui: { size: "sm", body: "scroll" }, end: () => { release(); body.remove(); } });
        release = dependencies.scope.addCleanup(() => { dependencies.dialog.close(index); body.remove(); });
    });
    bind("#webdavSyncHistoryBtn", async () => {
        const files = await service.listRecoveryFiles(dependencies.scope);
        if (!active()) return;
        const select = root.find("#webdavSyncRecoveryFile").empty();
        for (const file of files.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) select.append(dependencies.jquery("<option></option>").val(file.name).text(`${formatUiDateTime(file.createdAt)} · 设备 ${file.replicaId.slice(0, 8)} · 版本 ${file.seq}`));
        if (!files.length) select.append(dependencies.jquery("<option></option>").val("").text("暂无恢复版本"));
        JhsSelect.refreshAll(root);
        select.trigger("change");
    });
    bind("#webdavSyncRestoreBtn", async () => {
        const name = String(root.find("#webdavSyncRecoveryFile").val() || "");
        if (!name) throw new Error("请先选择恢复版本");
        const selection = { data: root.find("#webdavSyncRestoreData").is(":checked"), preferences: root.find("#webdavSyncRestorePreferences").is(":checked") };
        const layout = root.find("#webdavSyncRestoreLayout").is(":checked");
        const preview = await service.previewRecovery(name, layout, dependencies.scope, selection);
        if (active()) showDiffPreview(preview.diff, null, null, dependencies.dialog, dependencies, preview.apply);
    });
    root.on("jhsAutoBackupFormLoaded.jhsSync", () => { void render(); });
    dependencies.scope?.listen(service, "status", () => { void render(); });
    dependencies.scope?.addCleanup(() => { generation++; root.off(".jhsSync"); root.find("button").off(".jhsSync"); });
    void render();
}
