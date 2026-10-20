import { webcrypto } from "node:crypto";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UnifiedOfflineController } from "../src/features/external-bridge/unified-offline-controller.js";
import { OfflineSubmissionReceiptService } from "../src/services/offline-submission-receipt-service.js";
import { OfflineService } from "../src/services/offline-service.js";
import { HttpService } from "../src/services/http-service.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { UserscriptHttpAdapter } from "../src/platform/userscript/userscript-http-adapter.js";
import { createIntegrationRequestFacade } from "../src/app/integration-registry.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import panManifest, { createPan123Adapter } from "../src/integrations/pan123/manifest.js";
import oneManifest, { createOne115Adapter } from "../src/integrations/one115/manifest.js";

const resource = "magnet:?xt=urn:btih:0123456789012345678901234567890123456789";
const contexts = [];
afterEach(() => { for (const c of contexts.splice(0)) { c.scope.dispose(); c.dom.window.close(); } });

function setup(providerId = "123", outcomes = ["timeout", "success"]) {
    const dom = new JSDOM('<button class="jhs-offline-btn">离线</button>', { url: "https://javdb.example/v/abc-1" });
    Object.defineProperty(dom.window, "crypto", { value: webcrypto });
    dom.window.TextEncoder = TextEncoder;
    const $ = jqueryFactory(dom.window), history = [], mutationRequests = [], requests = [];
    const settings = { enable123Offline: providerId === "123", enable115Offline: providerId === "115", offlineProviderMode: providerId };
    const scope = new LifecycleScope("test:offline-outcome"), receipts = new OfflineSubmissionReceiptService(dom.window.localStorage);
    const pendingCallbacks = [], beforeMutation = vi.fn(), preparation = { failure: null };
    const gm = vi.fn(options => {
        requests.push(options);
        const isMutation = options.url.includes("/task/submit") || options.url.includes("ac=add_task_url");
        if (isMutation) mutationRequests.push(options);
        const outcome = isMutation ? outcomes.shift() : preparation.failure || "prepare";
        queueMicrotask(() => {
            if (outcome === "held") { pendingCallbacks.push(options); return; }
            if (outcome === "timeout") return options.ontimeout();
            if (outcome === "network") return options.onerror(new Error("connection lost"));
            if (outcome === "abort") return options.onabort();
            if (!isMutation && beforeMutation.mock.calls.length === 0) beforeMutation();
            const payload = outcome === "prepare"
                ? providerId === "123" ? { code: 0, data: { list: [{ id: 42, files: [{ id: 101, size: 100 }] }] } } : { sign: "synthetic", uid: 1, time: 1 }
                : outcome === "refused" ? providerId === "123" ? { code: 500, message: "quota exceeded" } : { state: false, error_msg: "quota exceeded" }
                : outcome === "exists" ? { state: false, error_msg: "该任务已存在" }
                : providerId === "123" ? { code: 0 } : { state: true, task_id: "task" };
            options.onload({ status: outcome === "server-error" ? 503 : 200, response: outcome === "malformed" ? "not-json" : payload, responseText: outcome === "malformed" ? "not-json" : JSON.stringify(payload), finalUrl: options.url });
        });
        return { abort() {} };
    });
    const http = new HttpService(new UserscriptHttpAdapter(gm, null), new ExternalUrlPolicy(), { settings: { snapshot: () => settings } });
    const facade = createIntegrationRequestFacade(http, providerId === "123" ? panManifest : oneManifest);
    const adapter = providerId === "123" ? createPan123Adapter(facade) : createOne115Adapter(facade);
    const offline = new OfflineService(null, { getAdapter: () => adapter });
    let lockHeld = false;
    const locks = { request: vi.fn(async (_key, _options, action) => {
        if (lockHeld) return action(null);
        lockHeld = true;
        try { return await action({}); } finally { lockHeld = false; }
    }) };
    Object.defineProperty(dom.window.navigator, "locks", { value: locks });
    const notices = { ok: vi.fn(), error: vi.fn(), info: vi.fn() }, dialogs = [];
    const dialog = {
        open: vi.fn(options => { options.content = $(options.content); dialogs.push(options); options.content.appendTo(dom.window.document.body); return dialogs.length; }),
        close: vi.fn(id => { dialogs[id - 1]?.content.remove(); dialogs[id - 1]?.end(); }),
    };
    const state = { appendOfflineHistory: vi.fn(async record => { expect(lockHeld).toBe(true); history.push(record); }) };
    const plugin = new UnifiedOfflineController({
        window: dom.window, document: dom.window.document, route: "detail", site: "javdb",
        hostAdapter: { site: "javdb", locateListItems: () => [], readMovieRef: () => ({ carNum: "ABC-1" }) },
        offline, submissionReceipts: receipts, state, settings: { snapshot: () => settings }, scope,
        pan123Credential: { getStoredToken: async () => "synthetic-token" }, dialog,
        ui: { jquery: $, confirm: vi.fn(), getOwningLayerIndex: () => null }, notifications: notices, diagnostics: { recordError: vi.fn() },
    });
    plugin.registerProviders();
    const context = { plugin, dom, $, scope, receipts, history, state, notices, dialogs, settings, mutationRequests, requests, pendingCallbacks, beforeMutation, preparation, locks,
        submit: retryOf => plugin.submitResource({}, resource, $("button.jhs-offline-btn"), { carNum: "ABC-1" }, retryOf),
        key: () => plugin.getSubmissionReceiptKey(resource),
    };
    contexts.push(context);
    return context;
}

describe("offline mutation outcomes through the real transport boundary", () => {
    it.each(["123", "115"])("retains an unknown %s receipt and sends only after explicit confirmation", async providerId => {
        const c = setup(providerId);
        await c.submit();
        const key = await c.key(), original = c.receipts.getRaw(key);
        expect(JSON.parse(original)).toMatchObject({ state: "pending", providerId });
        expect(c.history[0]).toMatchObject({ status: "pending", submissionOutcome: "unknown", errorCode: "TIMEOUT" });
        const retry = c.submit();
        await vi.waitFor(() => expect(c.dialogs).toHaveLength(1));
        expect(c.mutationRequests).toHaveLength(1);
        expect(c.dialogs[0].content.find("a").attr("href")).toMatch(/^https:/);
        c.dialogs[0].btn2();
        await retry;
        expect(c.mutationRequests).toHaveLength(2);
        expect(c.receipts.read(key, 1000)).toMatchObject({ state: "submitted" });
        expect(c.history[1]).toMatchObject({ status: "submitted" });
        expect(c.requests.filter(x => x.url.includes("/resolve") || x.method === "GET")).toHaveLength(2);
        expect(c.plugin._cleanupReleases.size).toBe(1); // Only the short-lived button timer remains.
    });

    it.each(["timeout", "network", "abort", "malformed", "server-error"])("keeps pending for dispatched %s instead of an automatic retry", async outcome => {
        const c = setup("123", [outcome]);
        await c.submit();
        expect(c.mutationRequests).toHaveLength(1);
        expect(c.receipts.read(await c.key(), 1).state).toBe("pending");
        expect(c.history[0].submissionOutcome).toBe("unknown");
        expect(c.notices.error).not.toHaveBeenCalled();
    });

    it.each(["123", "115"])("restores the receipt after a definite %s refusal and permits a manual retry", async providerId => {
        const c = setup(providerId, ["refused", "success"]);
        await c.submit();
        expect(c.receipts.getRaw(await c.key())).toBeNull();
        expect(c.history[0]).toMatchObject({ status: "failed", submissionOutcome: "failed" });
        await c.submit();
        expect(c.mutationRequests).toHaveLength(2);
        expect(c.dialogs).toHaveLength(0);
    });

    it("treats TASK_EXISTS as an acknowledged existing task", async () => {
        const c = setup("115", ["exists"]);
        await c.submit();
        expect(c.receipts.read(await c.key(), 1000).state).toBe("submitted");
        expect(c.history[0]).toMatchObject({ status: "submitted", submissionOutcome: "exists", errorCode: "TASK_EXISTS" });
        expect(c.notices.ok).toHaveBeenCalledWith("云端任务已存在");
        expect(c.plugin.ui.confirm).not.toHaveBeenCalled();
    });

    it.each(["123", "115"])("releases a %s reservation when preparation fails before mutation", async providerId => {
        const c = setup(providerId, ["success"]);
        c.preparation.failure = "network";
        await c.submit();
        expect(c.mutationRequests).toHaveLength(0);
        expect(c.receipts.getRaw(await c.key())).toBeNull();
        expect(c.history[0]).toMatchObject({ status: "failed", submissionOutcome: "failed", errorCode: "NETWORK_ERROR" });
        c.preparation.failure = null;
        await c.submit();
        expect(c.mutationRequests).toHaveLength(1);
        expect(c.dialogs).toHaveLength(0);
    });

    it.each(["123", "115"])("checks cancellation and settings again after %s preparation", async providerId => {
        for (const change of ["disabled", "removed"]) {
            const c = setup(providerId);
            c.beforeMutation.mockImplementation(() => { if (change === "disabled") c.settings[`enable${providerId}Offline`] = false; else c.$("button").remove(); });
            await c.submit();
            expect(c.mutationRequests).toHaveLength(0);
            expect(c.receipts.getRaw(await c.key())).toBeNull();
            expect(c.history).toHaveLength(0);
        }
    });

    it("keeps a dispatched cancellation durable without updating a closed surface", async () => {
        const c = setup("123", ["held"]);
        const pending = c.submit();
        await vi.waitFor(() => expect(c.pendingCallbacks).toHaveLength(1));
        c.scope.dispose();
        await pending;
        expect(c.receipts.read(await c.key(), 1).state).toBe("pending");
        expect(c.history[0]).toMatchObject({ status: "pending", errorCode: "ABORTED" });
        expect(c.notices.info).not.toHaveBeenCalled();
        expect(c.notices.error).not.toHaveBeenCalled();
        expect(c.$("button").text()).toBe("提交中");
        c.pendingCallbacks[0].onload({ status: 200, response: { code: 0 } });
        expect(c.receipts.read(await c.key(), 1).state).toBe("pending");
    });

    it("keeps confirmation reachable when recording the unknown history fails", async () => {
        const c = setup();
        c.state.appendOfflineHistory.mockRejectedValueOnce(new Error("disk"));
        await c.submit();
        const retry = c.submit();
        await vi.waitFor(() => expect(c.dialogs).toHaveLength(1));
        c.dialogs[0].yes();
        await retry;
        expect(c.mutationRequests).toHaveLength(1);
        expect(c.receipts.read(await c.key(), 1).state).toBe("pending");
    });

    it.each(["receipt", "provider", "scope"])("does not dispatch when %s changes during confirmation", async change => {
        const c = setup();
        await c.submit();
        const retry = c.submit();
        await vi.waitFor(() => expect(c.dialogs).toHaveLength(1));
        if (change === "receipt") c.receipts.write(await c.key(), "submitted", { attemptId: "other", providerId: "123" });
        if (change === "provider") c.settings.enable123Offline = false;
        if (change === "scope") c.scope.dispose();
        else c.dialogs[0].btn2();
        await retry;
        expect(c.mutationRequests).toHaveLength(1);
    });

    it("does not let retryOf bypass confirmation even without a receipt", async () => {
        const c = setup("123", ["success"]);
        const retry = c.submit("legacy-history-id");
        await vi.waitFor(() => expect(c.dialogs).toHaveLength(1));
        expect(c.mutationRequests).toHaveLength(0);
        c.dialogs[0].cancel();
        await retry;
        expect(c.receipts.getRaw(await c.key())).toBeNull();
    });

    it("allows a known failure history retry only when no protective receipt exists", async () => {
        const c = setup("123", ["success"]);
        const retry = () => c.plugin.submitResource({}, resource, c.$("button"), { carNum: "ABC-1" }, "failed-attempt", { previousOutcome: "failed" });
        await retry();
        expect(c.dialogs).toHaveLength(0);
        expect(c.mutationRequests).toHaveLength(1);
        c.$("button").removeClass("loading");
        c.receipts.write(await c.key(), "pending", { attemptId: "uncertain-attempt", providerId: "123" });
        const pending = retry();
        await vi.waitFor(() => expect(c.dialogs).toHaveLength(1));
        c.dialogs[0].cancel();
        await pending;
        expect(c.mutationRequests).toHaveLength(1);
    });

    it.each(["candidates", "enabled"])("does not notify a closed surface after awaiting %s", async stage => {
        const c = setup();
        if (stage === "candidates") c.plugin.registry.getCandidates = async () => { c.scope.dispose(); return []; };
        else c.plugin.registry.providers.get("123").isEnabled = vi.fn().mockResolvedValueOnce(true).mockImplementation(async () => { c.scope.dispose(); return false; });
        await c.submit();
        expect(c.notices.error).not.toHaveBeenCalled();
        expect(c.notices.info).not.toHaveBeenCalled();
        expect(c.requests).toHaveLength(0);
    });

    it("never switches an explicit history retry to a different provider", async () => {
        const c = setup("123", ["success"]);
        await c.plugin.submitResource({}, resource, c.$("button"), { carNum: "ABC-1" }, "legacy-history-id", { preferredProviderId: "115" });
        expect(c.mutationRequests).toHaveLength(0);
        expect(c.dialogs).toHaveLength(0);
        expect(c.notices.info).toHaveBeenCalledWith("原服务不可用，请恢复后核实重试");
    });

    it("does not dispatch if reserving a receipt fails", async () => {
        const c = setup();
        vi.spyOn(c.receipts, "write").mockImplementation(() => { throw new Error("disk"); });
        await c.submit();
        expect(c.mutationRequests).toHaveLength(0);
        expect(c.requests).toHaveLength(0);
        expect(c.history).toHaveLength(0);
    });
});
