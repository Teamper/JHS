// @ts-check

export const AUTO_BACKUP_DEFAULTS = Object.freeze({
    webDavAutoBackupEnabled: "no", webDavAutoBackupOnChanges: "yes", webDavAutoBackupOnInterval: "yes",
    webDavAutoBackupChangeCount: 100, webDavAutoBackupMinutes: 30, webDavAutoBackupKeepCount: 10,
});
export const AUTO_BACKUP_KEYS = Object.freeze(Object.keys(AUTO_BACKUP_DEFAULTS));
/** @param {unknown} value */
export const backupEnabled = value => value === true || value === "yes";
/** @param {unknown} value */
export const validBackupNumber = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= 1e6;
/** @param {any} settings */
export function autoBackupPolicy(settings) {
    const values = { ...AUTO_BACKUP_DEFAULTS, ...settings };
    for (const key of ["webDavAutoBackupChangeCount", "webDavAutoBackupMinutes", "webDavAutoBackupKeepCount"]) {
        if (!validBackupNumber(values[key])) throw new Error("自动备份条数、分钟和保留份数须为 1 至 1000000 的整数");
    }
    const changes = backupEnabled(values.webDavAutoBackupOnChanges), interval = backupEnabled(values.webDavAutoBackupOnInterval);
    if (backupEnabled(values.webDavAutoBackupEnabled) && !changes && !interval) throw new Error("请至少选择一种自动备份触发方式");
    return { enabled: backupEnabled(values.webDavAutoBackupEnabled), changes, interval, changeCount: Number(values.webDavAutoBackupChangeCount), minutes: Number(values.webDavAutoBackupMinutes), keepCount: Number(values.webDavAutoBackupKeepCount) };
}

/** @param {string} sourceId @param {number} now */
export function autoBackupFileName(sourceId, now) { return `auto_${sourceId}_${new Date(now).toISOString().replace(/[-:.]/g, "")}_${crypto.randomUUID()}.json`; }
/** @param {string} name @param {string} sourceId */
export function isManagedBackup(name, sourceId) {
    if (!/^[a-f0-9-]{36}$/.test(sourceId)) return false;
    return new RegExp(`^auto_${sourceId}_[0-9]{8}T[0-9]{9}Z_[a-f0-9-]{36}\\.json$`).test(name);
}
