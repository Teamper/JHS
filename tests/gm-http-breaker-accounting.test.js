import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GmHttp } from "../src/core/http.js";

describe("GmHttp breaker accounting", () => {
    beforeEach(() => {
        globalThis.clog = { error: vi.fn(), warn: vi.fn() };
    });

    afterEach(() => {
        delete globalThis.GM_xmlhttpRequest;
        delete globalThis.clog;
    });

    function createHttp(retries = 3) {
        const storageManager = {
            getSetting: vi.fn(async (key, fallback) => key === "httpRetryCount" ? retries : fallback)
        };
        const utils = {
            retry: async (operation, count) => {
                let error;
                for (let attempt = 0; attempt < count; attempt++) {
                    try { return await operation(); } catch (caught) { error = caught; }
                }
                throw error;
            }
        };
        return new GmHttp({ utils, storageManager });
    }

    it("counts a retried server failure once toward the circuit", async () => {
        const http = createHttp();
        globalThis.GM_xmlhttpRequest = vi.fn((options) => options.onload({ status: 503, responseText: "unavailable", finalUrl: options.url }));

        await expect(http.get("https://example.test/data")).rejects.toThrow("unavailable");

        expect(globalThis.GM_xmlhttpRequest).toHaveBeenCalledTimes(3);
        expect(http.getCircuitBreakerStatus()["example.test"]).toMatchObject({ state: "closed", failCount: 1 });
    });

    it("does not let ordinary client or rate-limit responses poison the domain circuit", async () => {
        const http = createHttp(1);
        for (const status of [ 404, 429 ]) {
            globalThis.GM_xmlhttpRequest = vi.fn((options) => options.onload({ status, responseText: "rejected", finalUrl: options.url }));
            await expect(http.get(`https://example.test/${status}`)).rejects.toThrow("rejected");
        }

        expect(http.getCircuitBreakerStatus()["example.test"]).toMatchObject({ state: "closed", failCount: 0 });
    });
});
