import { describe, expect, it, vi } from "vitest";
import { BlacklistScanController } from "../src/features/library/blacklist-scan-controller.js";

function createController({ records = [], request = vi.fn(async () => ({ data: "page" })), parsePage = vi.fn(async (_html, item) => ({ records: [{ carNum: `${item.starId}-001` }], lastPublishTime: "2026-09-20" })) } = {}) {
    const state = {
        getBlacklist: vi.fn(async () => records),
        batchSaveBlacklistCarList: vi.fn(async () => true),
        updateBlacklistItem: vi.fn(async () => true),
    };
    const http = { request };
    const settings = { snapshot: vi.fn(() => ({})) };
    const movie = { externalSiteOrigin: vi.fn((siteId) => siteId === "javDbBtn" ? "https://javdb.com" : "https://javbus.com") };
    const scope = { disposed: false };
    const controller = new BlacklistScanController({ state, http, settings, movie, scope, parsePage });
    const options = {
        currentHostname: "javdb.com", concurrency: 1, sleepMs: 0, intervalHours: 12, ruleHours: 8760, force: false,
        isUnnecessaryCheck: (_date, interval) => interval === 12,
        isNetworkBlocked: (error) => ["CF_BLOCKED", "CIRCUIT_OPEN", "ABORTED"].includes(error?.code),
        sleep: vi.fn(async () => {}), getTimestamp: () => "2026-09-27 15:00:00",
        requestConfig: { httpTimeout: 10000, httpRetryCount: 2, circuitBreakerThreshold: 4, circuitBreakerCooldown: 30000 },
    };
    return { controller, state, http, settings, movie, scope, options, parsePage };
}

describe("BlacklistScanController", () => {
    it("preserves host, interval, stopped and source filtering before feature-owned writes", async () => {
        const records = [
            { starId: "primary", name: "Primary", url: "https://javdb.com/actors/primary?t=d", createTime: "2026-09-27" },
            { starId: "other-host", name: "Other", url: "https://javbus.com/star/other", createTime: "2026-09-26" },
            { starId: "recent", name: "Recent", url: "https://javdb.com/actors/recent", checkTime: "recent", createTime: "2026-09-25" },
            { starId: "stopped", name: "Stopped", url: "https://javdb.com/actors/stopped", lastPublishTime: "2010-01-01", createTime: "2026-09-24" },
            { starId: "custom", name: "Custom", url: "https://unknown.example/actors/custom", createTime: "2026-09-23" },
        ];
        const setup = createController({ records });
        const result = await setup.controller.scan(setup.options);

        expect(result).toMatchObject({ success: 1, networkFailed: 0, parseFailed: 0, skippedHost: 2, skippedInterval: 1, skippedStopped: 1, aborted: 0 });
        expect(setup.http.request).toHaveBeenCalledOnce();
        expect(setup.http.request).toHaveBeenCalledWith(expect.objectContaining({
            providerId: "host-task:javdb", url: "https://javdb.com/actors/primary?t=d", timeout: 10000, retryCount: 1,
            transport: "native-fetch", nativeTimeout: 10000,
            urlPolicy: { trustClass: "builtin-public", hosts: ["javdb.com"], expectedOrigin: "https://javdb.com" },
        }), setup.scope);
        expect(setup.parsePage).toHaveBeenCalledWith("page", records[0], "javdb");
        expect(setup.state.batchSaveBlacklistCarList).toHaveBeenCalledWith([{ carNum: "primary-001" }]);
        expect(setup.state.updateBlacklistItem).toHaveBeenCalledWith({ starId: "primary", name: "Primary", checkTime: "2026-09-27 15:00:00", lastPublishTime: "2026-09-20" });
    });

    it("counts ordinary request failures and continues to the next actor", async () => {
        const records = [
            { starId: "timeout", name: "Timeout", url: "https://javdb.com/actors/timeout", createTime: "2026-09-27" },
            { starId: "next", name: "Next", url: "https://javdb.com/actors/next", createTime: "2026-09-26" },
        ];
        const timeout = Object.assign(new Error("timeout"), { code: "TIMEOUT" });
        const request = vi.fn().mockRejectedValueOnce(timeout).mockResolvedValueOnce({ data: "page" });
        const setup = createController({ records, request });

        const result = await setup.controller.scan(setup.options);

        expect(result).toMatchObject({ success: 1, networkFailed: 1, parseFailed: 0, aborted: 0 });
        expect(request).toHaveBeenCalledTimes(2);
        expect(setup.state.updateBlacklistItem).toHaveBeenCalledOnce();
    });

    it("stops claiming actors after a blocking response and reports the remainder", async () => {
        const records = ["one", "two", "three"].map((starId, index) => ({
            starId, name: starId, url: `https://javdb.com/actors/${starId}`, createTime: `2026-09-${27 - index}`,
        }));
        const blocked = Object.assign(new Error("blocked"), { code: "CF_BLOCKED" });
        const request = vi.fn(async () => { throw blocked; });
        const setup = createController({ records, request });

        const result = await setup.controller.scan(setup.options);

        expect(request).toHaveBeenCalledOnce();
        expect(result).toMatchObject({ success: 0, networkFailed: 1, fatal: true, aborted: 2, blockedError: blocked });
        expect(setup.state.batchSaveBlacklistCarList).not.toHaveBeenCalled();
    });

    it("does not parse or commit a response that arrives after Feature disposal", async () => {
        let resolveRequest;
        const request = () => new Promise((resolve) => { resolveRequest = resolve; });
        const setup = createController({ records: [{ starId: "late", name: "Late", url: "https://javdb.com/actors/late", createTime: "2026-09-27" }], request });
        const pending = setup.controller.scan(setup.options);
        await vi.waitFor(() => expect(resolveRequest).toBeTypeOf("function"));
        setup.controller.dispose();
        resolveRequest({ data: "late page" });

        await expect(pending).rejects.toMatchObject({ name: "AbortError" });
        expect(setup.parsePage).not.toHaveBeenCalled();
        expect(setup.state.batchSaveBlacklistCarList).not.toHaveBeenCalled();
        expect(setup.state.updateBlacklistItem).not.toHaveBeenCalled();
    });

    it("keeps parser failures separate from request failures", async () => {
        const parsePage = vi.fn(async () => { throw new Error("invalid actor page"); });
        const setup = createController({ records: [{ starId: "bad", name: "Bad", url: "https://javdb.com/actors/bad", createTime: "2026-09-27" }], parsePage });

        const result = await setup.controller.scan(setup.options);

        expect(result).toMatchObject({ success: 0, networkFailed: 0, parseFailed: 1, aborted: 0 });
        expect(setup.state.batchSaveBlacklistCarList).not.toHaveBeenCalled();
    });

    it("reports transport and login-gate hints without logging the returned page", async () => {
        const loginResponse = "window.location.href='/login';";
        const request = vi.fn(async () => ({
            status: 200, data: loginResponse, transportUsed: "gm", nativeFallbackCode: "TIMEOUT",
        }));
        const parsePage = vi.fn(async () => { throw new Error("黑名单作品页面无效: invalid"); });
        const setup = createController({ records: [{ starId: "gated", name: "Gated", url: "https://javdb.com/tags?c3=192", createTime: "2026-09-27" }], request, parsePage });
        const onError = vi.fn();
        const result = await setup.controller.scan({ ...setup.options, onError });

        expect(result).toMatchObject({ parseFailed: 1, networkFailed: 0 });
        const message = onError.mock.calls[0][2].message;
        expect(message).toContain("transport=gm, fallback=TIMEOUT, status=200");
        expect(message).toContain("loginRedirect=true");
        expect(message).not.toContain(loginResponse);
    });
});
