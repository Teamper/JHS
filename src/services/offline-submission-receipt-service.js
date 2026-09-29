// @ts-check

/** Stores short-lived offline submission receipts separately from IndexedDB history. */
export class OfflineSubmissionReceiptService {
    /** @param {Storage} storage */
    constructor(storage) { this.storage = storage; }

    /** @param {string} key */
    getRaw(key) { return this.storage.getItem(key); }

    /** @param {string} key @param {number} maxAgeMs */
    read(key, maxAgeMs) {
        const raw = this.getRaw(key);
        if (!raw) return null;
        try {
            const receipt = JSON.parse(raw);
            if (["submitted", "pending"].includes(receipt?.state) && Number.isFinite(receipt.at) && Date.now() - receipt.at < maxAgeMs) return receipt;
        } catch { /* Invalid receipts are replaced by the next submission. */ }
        return null;
    }

    /** @param {number} maxAgeMs */
    prune(maxAgeMs) {
        for (let index = this.storage.length - 1; index >= 0; index--) {
            const key = this.storage.key(index);
            if (key?.startsWith("jhs_offline_receipt_v1:") && !this.read(key, maxAgeMs)) this.storage.removeItem(key);
        }
    }

    /** @param {string} key @param {"pending"|"submitted"} state */
    write(key, state) { this.storage.setItem(key, JSON.stringify({ state, at: Date.now() })); }

    /** @param {string} key @param {string|null} previous */
    restore(key, previous) {
        if (previous === null) this.storage.removeItem(key);
        else this.storage.setItem(key, previous);
    }
}
