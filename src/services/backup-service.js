// @ts-check

import { encryptPortableBackup } from "../core/credential-crypto.js";

/** A UI-free upload shared by manual and scheduled backups. @param {any} options */
export async function uploadWebDavBackup(options) {
    const measure = options.measure ?? (async (/** @type {string} */ _stage, /** @type {() => any} */ action) => action());
    const assertActive = () => {
        if (options.scope?.disposed || options.isActive?.() === false) throw new DOMException("备份已取消", "AbortError");
    };
    const snapshot = await measure("导出数据", options.exportSnapshot);
    assertActive();
    const encrypted = await measure("加密", () => encryptPortableBackup(JSON.stringify(snapshot.data)));
    assertActive();
    const client = options.webdav.createClient(options.profile, { scope: options.scope });
    await client.backup(options.folderName, options.fileName, encrypted, options.onStage);
    assertActive();
    return { client, fileName: options.fileName, coveredRevision: snapshot.revision, completedAt: Date.now(), bytes: encrypted.length };
}
