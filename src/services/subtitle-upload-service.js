// @ts-check
import { parseSubtitleAsset, subtitleFilename } from "../core/subtitle-asset.js";

const PREFIX = "jhs_subtitle_upload_v1_";

/** @param {ArrayBuffer} bytes */
async function digest(bytes) { return [...new Uint8Array(await crypto.subtle.digest("SHA-1", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join(""); }

export class SubtitleUploadService {
    /** @param {{offline: any, storage: any, matching: any, events?: any, locks?: LockManager | null}} options */
    constructor(options) { this.options = options; this.locks = options.locks === undefined ? globalThis.navigator?.locks : options.locks; }

    availability() { return this.locks?.request ? null : "当前浏览器缺少跨标签互斥能力，暂不能安全上传"; }
    /** @param {{scope?: any}} [options] */
    currentAccount(options = {}) { return this.options.offline.getAccountIdentity("one115", options); }

    /** @param {{accountId?: string, carNum?: string}} [filter] */
    async records(filter = {}) {
        const keys = await this.options.storage.listValues();
        const results = [];
        for (const key of keys) {
            if (!String(key).startsWith(PREFIX)) continue;
            const record = await this.options.storage.getValue(key);
            if (record?.version !== 1 || record?.key !== key || !/^\d+$/.test(record.accountId) || !/^\d+$/.test(record.folderId)) continue;
            if (filter.accountId && record.accountId !== filter.accountId || filter.carNum && record.carNum !== filter.carNum) continue;
            results.push(record);
        }
        return results.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    /** @param {any} record @param {string} state @param {string} message */
    async save(record, state, message) {
        const next = { ...record, state, message, updatedAt: Date.now() };
        await this.options.storage.setValue(record.key, next);
        return next;
    }

    /** @param {any} record @param {{scope?: any}} options */
    async inspect(record, options) {
        const account = await this.options.offline.getAccountIdentity("one115", options);
        if (account.accountId !== record.accountId) throw new TypeError("115 账号已切换，原上传记录已暂停");
        const verified = async (/** @type {any} */ evidence) => {
            options.scope?.assertActive();
            const current = await this.options.offline.getAccountIdentity("one115", options);
            if (current.accountId !== record.accountId) throw new TypeError("115 账号已切换，原上传记录已暂停");
            return evidence;
        };
        let offset = 0;
        const visited = new Set();
        for (let page = 0; page < 10; page++) {
            const result = await this.options.offline.listDirectory("one115", record.folderId, { ...options, offset, limit: 100 });
            const fingerprint = result.items.map((/** @type {any} */ item) => `${item.fileId}/${item.name}`).join("|");
            if (fingerprint && visited.has(fingerprint)) throw new TypeError("115 目录分页重复，结果未完整");
            visited.add(fingerprint);
            const sameName = result.items.filter((/** @type {any} */ item) => !item.isFolder && item.name === record.filename);
            const identical = sameName.find((/** @type {any} */ item) => item.size === record.size && (item.sha1 && item.sha1.toLowerCase() === record.sha1 || record.fileId && item.fileId === record.fileId));
            if (identical) return verified({ identical, sameName: true, complete: true });
            if (sameName.length) return verified({ identical: null, sameName: true, complete: true });
            if (!result.hasMore) return verified({ identical: null, sameName: false, complete: true });
            if (!Number.isSafeInteger(result.nextOffset) || result.nextOffset <= offset) throw new TypeError("115 目录分页未推进");
            offset = result.nextOffset;
        }
        return verified({ identical: null, sameName: false, complete: false });
    }

    /** Only positive remote evidence settles an uncertain dispatch. @param {any} record @param {{scope?: any}} [options] */
    async reconcile(record, options = {}) {
        const blocked = this.availability();
        if (blocked) throw new TypeError(blocked);
        return /** @type {LockManager} */ (this.locks).request(record.key, async () => {
            const current = await this.options.storage.getValue(record.key);
            if (!current || current.version !== 1) throw new TypeError("上传恢复记录无效");
            const evidence = await this.inspect(current, options);
            if (evidence.identical) return this.finish(current, evidence.identical.fileId);
            return this.save(current, "pending", evidence.complete ? "远端证据不足，请保留记录并核对目录" : "目录结果未完整，上传结果待确认");
        });
    }

    /** @param {any} record @param {string} fileId */
    async finish(record, fileId) {
        const next = await this.save({ ...record, fileId }, "success", "已核实上传完成");
        this.options.matching.clear();
        await this.options.events?.emit("subtitle.uploaded", { carNum: record.carNum, folderId: record.folderId, accountId: record.accountId });
        return next;
    }

    /** One durable intent per account/directory/name. A recovered ambiguous request is never replayed. @param {{carNum: string, accountId: string, folderId: string, filename: string, bytes: ArrayBuffer}} input @param {{scope?: any}} [options] */
    async submit(input, options = {}) {
        const blocked = this.availability();
        if (blocked) throw new TypeError(blocked);
        const extension = input.filename.split(".").pop() || "";
        if (subtitleFilename(input.filename, extension) !== input.filename || !/^\d+$/.test(input.accountId) || !/^\d+$/.test(input.folderId)) throw new TypeError("字幕上传目标无效");
        const asset = parseSubtitleAsset(input.bytes, { extension });
        const sha1 = await digest(asset.bytes);
        const key = PREFIX + await digest(new TextEncoder().encode(JSON.stringify([input.accountId, input.folderId, input.filename])).buffer);
        return /** @type {LockManager} */ (this.locks).request(key, async () => {
            options.scope?.assertActive();
            let record = await this.options.storage.getValue(key);
            if (record && (record.version !== 1 || record.accountId !== input.accountId || record.folderId !== input.folderId || record.filename !== input.filename)) throw new TypeError("上传记录版本或目标无效");
            const previous = record?.state;
            if (record && record.sha1 !== sha1) throw new TypeError("该文件名已有另一份上传记录，请更改名称或先核对远端");
            record ||= { version: 1, key, carNum: input.carNum, accountId: input.accountId, folderId: input.folderId, filename: input.filename, size: asset.size, sha1, createdAt: Date.now() };
            // This write must complete before directory requests and either POST.
            record = await this.save(record, previous || "prepared", record.message || "已保存上传意图");
            const before = await this.inspect(record, options);
            if (before.identical) return this.finish(record, before.identical.fileId);
            if (["dispatching", "pending", "success"].includes(previous)) return this.save(record, "pending", "原请求结果尚未核实，未重复上传");
            if (before.sameName) return this.save(record, "skipped", "目录已有同名文件，已跳过");
            if (!before.complete) return this.save(record, "failed", "目录结果未完整，未提交上传");
            record = await this.save(record, "dispatching", "正在上传，意外中断后需核对远端");
            let dispatched = false;
            try {
                const response = await this.options.offline.uploadSubtitle("one115", { ...input, bytes: asset.bytes }, { ...options, onMutationDispatch: () => { dispatched = true; } });
                record = await this.save({ ...record, fileId: response.fileId || "" }, "pending", "上传请求已完成，正在核对目录");
                const after = await this.inspect(record, options);
                if (after.identical) return this.finish(record, after.identical.fileId);
                return this.save(record, "pending", "上传响应已返回，远端文件尚待核实");
            } catch (error) {
                return this.save(record, dispatched ? "pending" : "failed", dispatched ? "上传结果不明，请核对远端后继续" : error instanceof Error ? error.message : "上传未提交");
            }
        });
    }
}
