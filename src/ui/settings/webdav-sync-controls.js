// @ts-check

import { formatUiDateTime } from "../../core/ui-date-time.js";
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
            const parts = [status.busy ? "正在同步…" : status.paused ? "同步已暂停" : status.enabled ? "自动同步已接入" : "尚未接入同步", `待发布 ${status.pendingChanges} 批修改`];
            if (status.lastSuccessAt) parts.push(`上次成功：${formatUiDateTime(status.lastSuccessAt)}`);
            if (status.retryAt && status.message) parts.push(`下次重试：${formatUiDateTime(status.retryAt)}`);
            else if (status.enabled && status.nextDueAt) parts.push(`下次检查：${formatUiDateTime(status.nextDueAt)}`);
            if (status.message) parts.push(status.message);
            if (status.cleanupError) parts.push(status.cleanupError);
            root.find("#jhs-auto-backup-status").text(parts.join("；"));
            root.find("#webdavSyncPauseBtn").text(status.paused ? "恢复本机同步" : "暂停本机同步");
            root.find("#webdavSyncChooseBtn").prop("hidden", !status.profileConflict).toggle(status.profileConflict);
        } catch { if (active()) root.find("#jhs-auto-backup-status").text("同步状态无法读取，请保留本地数据并检查存储"); }
    };
    /** @param {string} selector @param {() => Promise<void>} action */
    const bind = (selector, action) => root.find(selector).on("click.jhsSync", async (/** @type {any} */ event) => {
        const button = dependencies.jquery(event.currentTarget);
        if (button.prop("disabled")) return;
        button.prop("disabled", true).attr("aria-busy", "true");
        try { await action(); }
        catch (error) { if (active()) dependencies.notifications.error(/** @type {Error} */ (error).message); }
        finally { if (active()) { button.prop("disabled", false).removeAttr("aria-busy"); void render(); } }
    });
    bind("#webdavAutoVerifyBtn", async () => {
        if (root.data("jhsDirtyManualKeys")?.size) throw new Error("请先保存连接信息和版本保留设置");
        await service.retry();
    });
    bind("#webdavSyncPauseBtn", async () => { const status = await service.getStatus(); if (active()) await service.pause(!status.paused); });
    bind("#webdavSyncChooseBtn", async () => {
        await dependencies.webdav.saveProfile({ url: String(root.find("#webDavUrl").val() || "").trim(), username: String(root.find("#webDavUsername").val() || ""), password: String(root.find("#webDavPassword").val() || "") });
        if (active()) await service.retry();
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
        const confirmed = await new Promise(resolve => dependencies.utilities.q(null, "恢复所选版本将更新本机数据，并自动同步到其他端。继续？", () => resolve(true), () => resolve(false), { confirmText: "恢复", cancelText: "取消" }));
        if (!confirmed || !active()) return;
        await service.restore(name, root.find("#webdavSyncRestoreLayout").is(":checked"), dependencies.scope, { data: root.find("#webdavSyncRestoreData").is(":checked"), preferences: root.find("#webdavSyncRestorePreferences").is(":checked") });
        if (active()) dependencies.notifications.ok("恢复完成，已安排自动同步");
    });
    root.on("jhsAutoBackupFormLoaded.jhsSync", () => { void render(); });
    dependencies.scope?.listen(service, "status", () => { void render(); });
    dependencies.scope?.addCleanup(() => { generation++; root.off(".jhsSync"); root.find("button").off(".jhsSync"); });
    void render();
}
