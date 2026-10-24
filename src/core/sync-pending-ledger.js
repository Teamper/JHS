// @ts-check

import { SYNC_DOMAINS } from "./webdav-sync-model.js";

export const SYNC_PENDING_KEY = "jhs_webdav_sync_pending_v1";

/** Small local write-ahead intent; never included in portable data or the remote protocol. */
export class SyncPendingLedger {
    /** @param {any} forage @param {() => number} [clock] */
    constructor(forage, clock = () => Date.now()) { this.forage = forage; this.clock = clock; this.initialEpoch = crypto.randomUUID(); }
    async read() {
        const value = await this.forage.getItem(SYNC_PENDING_KEY);
        if (value && (value.schema !== 1 || !Number.isSafeInteger(value.generation) || !Number.isSafeInteger(value.metadataRevision)
            || value.generation < 0 || value.metadataRevision < 0 || !value.domains || !value.candidates || !Array.isArray(value.localUndoIds)
            || !value.localUndoIds.every((/** @type {any} */ id) => typeof id === "string") || typeof value.epoch !== "string" || !value.epoch || typeof value.replicaId !== "string"
            || Object.entries(value.domains).some(([key, generation]) => !SYNC_DOMAINS.includes(key) || !Number.isSafeInteger(generation) || Number(generation) > value.generation || Number(generation) < 1)
            || Object.entries(value.candidates).some(([key, floor]) => !["activity_log", "offline_history"].includes(key) || typeof floor !== "string"))) {
            throw new Error("同步待处理记录损坏或来自未来版本，已停止写入以保留数据");
        }
        return value || { schema: 1, generation: 0, metadataRevision: 0, epoch: this.initialEpoch, replicaId: "", domains: {}, candidates: {}, localUndoIds: [] };
    }
    /** Caller owns the shared storage lock. @param {any} value */
    async write(value) { await this.forage.setItem(SYNC_PENDING_KEY, value); return value; }
    /** Write intent precedes the business write. Candidate floors are verified against recovered business data before use. */
    /** @param {string} domain @param {string | undefined} floor */
    async capture(domain, floor) {
        const value = await this.read();
        if (!Number.isSafeInteger(value.generation + 1)) throw new Error("同步待处理记录版本已超出安全范围");
        value.domains[domain] = ++value.generation;
        value.firstPendingAt ||= this.clock(); value.lastPendingAt = this.clock();
        if (floor) value.candidates[domain] = [value.candidates[domain] || "", floor].sort().at(-1);
        return this.write(value);
    }
}
