// @ts-check

import { formatUiDateTime } from "../../core/ui-date-time.js";

/** Bind to an existing dialog instance; never update a closed settings surface. @param {any} root @param {any} dependencies */
export function bindAutoBackupControls(root, dependencies) {
    const service = dependencies.autoBackup;
    if (!service) return;
    let generation = 0;
    const active = () => !dependencies.scope?.disposed && dependencies.isActive?.() !== false;
    const sync = () => {
        const enabled = root.find("#webDavAutoBackupEnabled").is(":checked");
        root.find("#jhs-auto-backup-options").prop("hidden", !enabled);
        root.find("#webDavAutoBackupChangeCount").prop("disabled", !root.find("#webDavAutoBackupOnChanges").is(":checked"));
        root.find("#webDavAutoBackupMinutes").prop("disabled", !root.find("#webDavAutoBackupOnInterval").is(":checked"));
    };
    const render = async () => {
        const token = ++generation;
        try {
            const status = await service.getStatus();
            if (!active() || generation !== token) return;
            const parts = [status.busy ? "正在备份…" : status.enabled ? "自动备份已开启" : "自动备份已关闭", `累计更新 ${status.pendingChanges} 条`];
            if (status.lastSuccessAt) parts.push(`上次成功：${formatUiDateTime(status.lastSuccessAt)}`);
            if (status.enabled && !status.paused && status.nextDueAt) parts.push(`下次到期：${formatUiDateTime(status.nextDueAt)}`);
            if (status.enabled && !status.paused && status.retryAt && status.error) parts.push(`下次重试：${formatUiDateTime(status.retryAt)}`);
            if (status.message) parts.push(status.message);
            if (status.cleanupError) parts.push(status.cleanupError);
            root.find("#jhs-auto-backup-status").text(parts.join("；"));
        } catch { if (active()) root.find("#jhs-auto-backup-status").text("自动备份状态无法读取，请检查本地存储后重新验证"); }
    };
    root.on("change.jhsAutoBackup", "#webDavAutoBackupEnabled, #webDavAutoBackupOnChanges, #webDavAutoBackupOnInterval", sync);
    root.on("jhsAutoBackupFormLoaded", () => { sync(); void render(); });
    dependencies.scope?.listen(service, "status", () => { void render(); });
    root.find("#webdavAutoVerifyBtn").on("click", async (/** @type {any} */ event) => {
        const button = dependencies.jquery(event.currentTarget);
        const dirty = root.data("jhsDirtyManualKeys");
        if (dirty?.size) return dependencies.notifications.error("请先保存连接信息和备份策略，再重新验证");
        if (button.prop("disabled")) return;
        button.prop("disabled", true).attr("aria-busy", "true");
        try {
            await service.enable({ scope: dependencies.scope });
            if (active()) { root.find("#webDavAutoBackupEnabled").prop("checked", true); sync(); dependencies.notifications.ok("已验证并启用自动备份"); }
        } catch (error) {
            if (active()) dependencies.notifications.error(/** @type {Error} */ (error).message);
        } finally { if (active()) button.prop("disabled", false).removeAttr("aria-busy"); }
    });
    dependencies.scope?.addCleanup(() => { generation++; root.off(".jhsAutoBackup"); });
    sync(); void render();
}
