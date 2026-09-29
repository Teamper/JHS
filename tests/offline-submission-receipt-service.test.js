import { describe, expect, it, vi } from "vitest";
import { OfflineSubmissionReceiptService } from "../src/services/offline-submission-receipt-service.js";

function storageFixture() {
    const values = new Map();
    return {
        get length() { return values.size; },
        key: index => [...values.keys()][index] ?? null,
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); },
        removeItem: key => { values.delete(key); },
    };
}

describe("offline submission receipts", () => {
    it("prunes expired own receipts while preserving live and host keys", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-29T00:00:00Z"));
        try {
            const storage = storageFixture();
            storage.setItem("site-setting", "host-value");
            storage.setItem("jhs_offline_receipt_v1:old", JSON.stringify({ state: "submitted", at: Date.now() - 86_400_001 }));
            storage.setItem("jhs_offline_receipt_v1:live", JSON.stringify({ state: "pending", at: Date.now() - 1_000 }));
            const receipts = new OfflineSubmissionReceiptService(storage);
            receipts.prune(86_400_000);
            expect(storage.getItem("jhs_offline_receipt_v1:old")).toBeNull();
            expect(receipts.read("jhs_offline_receipt_v1:live", 86_400_000)?.state).toBe("pending");
            expect(storage.getItem("site-setting")).toBe("host-value");
        } finally { vi.useRealTimers(); }
    });
});
