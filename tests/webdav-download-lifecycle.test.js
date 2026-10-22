import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { syncFileName } from "../src/core/webdav-sync-model.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { HttpService } from "../src/services/http-service.js";
import { UserscriptHttpAdapter } from "../src/platform/userscript/userscript-http-adapter.js";
import { WebDavClient } from "../src/services/webdav-service.js";

const origin = "https://dav.example.test";
const name = syncFileName("01234567-1234-1234-1234-012345678901", 1, "2026-10-22T00:00:00.000Z", "a".repeat(64));
const redirect = (location, status = 302) => ({ status, responseHeaders: `Location: ${location}` });

function fixture(responses, scope) {
    const aborts = [];
    const request = vi.fn(options => {
        const abort = vi.fn(), response = responses[request.mock.calls.length - 1];
        aborts.push(abort);
        const deliver = value => options.onload({ status: 200, responseText: "snapshot", finalUrl: options.url, ...value });
        if (typeof response === "function") response(options, deliver);
        else deliver(response);
        return { abort };
    });
    const http = new HttpService(new UserscriptHttpAdapter(request), new ExternalUrlPolicy({ localOrigins: [origin] }), {
        settings: { snapshot: () => ({ httpTimeout: 1000, httpRetryCount: 1 }) },
    });
    const client = new WebDavClient(http, `${origin}/dav`, "user", "synthetic", scope);
    client.folderName = "JHS";
    return { client, request, aborts };
}

afterEach(() => vi.useRealTimers());

describe.each([
    ["manual", client => client.getFileContent("backup.json")],
    ["sync", client => client.readSyncFile(name)],
])("%s download lifecycle", (mode, read) => {
    it("retains origin authentication only until the first public redirect", async () => {
        const { client, request } = fixture([
            redirect("../same-origin.json", 301),
            redirect("https://cdn.example.test/signed?token=fixture", 307),
            redirect("https://cdn2.example.test/object", 308),
            redirect(`${origin}/dav/returned.json`, 303), {},
        ]);
        await expect(read(client)).resolves.toBe("snapshot");
        expect(request).toHaveBeenCalledTimes(5);
        for (const [index, [options]] of request.mock.calls.entries()) {
            const headers = { Accept: "application/octet-stream", ...(mode === "sync" ? { "Cache-Control": "no-cache" } : {}) };
            expect(options).toMatchObject({ method: "GET", redirect: "manual", timeout: 10_000 });
            if (index < 2) {
                expect(options.headers).toEqual({ Authorization: `Basic ${btoa("user:synthetic")}`, Depth: "1", ...headers });
                expect(options.anonymous).not.toBe(true);
            } else {
                expect(options.headers).toEqual(headers);
                expect(options.anonymous).toBe(true);
            }
            expect(options).not.toHaveProperty("cookie");
            expect(options).not.toHaveProperty("user");
            expect(options).not.toHaveProperty("password");
        }
    });

    it.each(["https://user:secret@cdn.example.test/file", "https://user@dav.example.test/file", "https://127.0.0.1/file", "http://cdn.example.test/file", "file:///file"])("rejects unsafe redirect %s before dispatch", async location => {
        const { client, request } = fixture([redirect(location)]);
        await expect(read(client)).rejects.toMatchObject({ code: "INVALID_URL" });
        expect(request).toHaveBeenCalledOnce();
    });

    it("rejects a redirect loop and a sixth redirect without another request", async () => {
        const loop = fixture([redirect("loop#one"), redirect("loop#two")]);
        await expect(read(loop.client)).rejects.toThrow("循环");
        expect(loop.request).toHaveBeenCalledTimes(2);
        const hops = Array.from({ length: 6 }, (_, index) => redirect(`https://cdn.example.test/hop-${index}`));
        const allowed = fixture([...hops.slice(0, 5), {}]);
        await expect(read(allowed.client)).resolves.toBe("snapshot");
        const blocked = fixture(hops);
        await expect(read(blocked.client)).rejects.toThrow("超过限制");
        expect(blocked.request).toHaveBeenCalledTimes(6);
    });

    it("rejects transports that silently follow a cross-origin redirect", async () => {
        const { client, request } = fixture([{ finalUrl: "https://cdn.example.test/object" }]);
        await expect(read(client)).rejects.toMatchObject({ code: "INVALID_URL" });
        expect(request).toHaveBeenCalledOnce();
    });

    it.each([200, 302])("does not return or follow a status %i received just before disposal", async status => {
        const scope = new LifecycleScope("download");
        const { client, request } = fixture([(_options, deliver) => {
            deliver({ ...redirect("next"), status });
            scope.dispose();
        }], scope);
        await expect(read(client)).rejects.toMatchObject({ name: "AbortError" });
        expect(request).toHaveBeenCalledOnce();
    });

    it("does not dispatch after the lifecycle was already disposed", async () => {
        const scope = new LifecycleScope("download");
        scope.dispose();
        const { client, request } = fixture([{}], scope);
        await expect(read(client)).rejects.toMatchObject({ name: "AbortError" });
        expect(request).not.toHaveBeenCalled();
    });

    it("aborts an in-flight redirected request and ignores its late callbacks", async () => {
        const scope = new LifecycleScope("download");
        let pending;
        let dispatched;
        const ready = new Promise(resolve => { dispatched = resolve; });
        const { client, request, aborts } = fixture([redirect("next"), options => { pending = options; dispatched(); }], scope);
        const result = read(client), rejected = expect(result).rejects.toMatchObject({ code: "ABORTED" });
        await ready;
        scope.dispose();
        pending.onload({ ...redirect("later"), finalUrl: pending.url });
        pending.ontimeout();
        await rejected;
        expect(aborts[1]).toHaveBeenCalledOnce();
        expect(request).toHaveBeenCalledTimes(2);
    });

    it("gives each HTTP hop its own ten seconds instead of timing out the chain", async () => {
        vi.useFakeTimers();
        const { client, request } = fixture([
            (_options, deliver) => setTimeout(() => deliver(redirect("next")), 9000),
            (_options, deliver) => setTimeout(() => deliver({}), 9000),
        ]);
        const result = read(client);
        await vi.advanceTimersByTimeAsync(18_000);
        await expect(result).resolves.toBe("snapshot");
        expect(request).toHaveBeenCalledTimes(2);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("times out a stalled redirected hop and ignores late success", async () => {
        vi.useFakeTimers();
        let pending;
        const { client, request, aborts } = fixture([redirect("next"), options => { pending = options; }]);
        const result = read(client), rejected = expect(result).rejects.toMatchObject({ code: "TIMEOUT" });
        await vi.advanceTimersByTimeAsync(10_000);
        await rejected;
        pending.onload({ status: 200, responseText: "late", finalUrl: pending.url });
        pending.ontimeout();
        expect(aborts[1]).toHaveBeenCalledOnce();
        expect(request).toHaveBeenCalledTimes(2);
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe("sync missing-file proof", () => {
    it.each([false, true])("accepts a 404 only on an entirely same-origin chain (redirect=%s)", async redirected => {
        const { client, request } = fixture([...(redirected ? [redirect("../canonical-object")] : []), { status: 404 }]);
        await expect(client.readSyncFile(name, true)).resolves.toBeNull();
        expect(request).toHaveBeenCalledTimes(redirected ? 2 : 1);
    });

    it.each([false, true])("does not accept a CDN 404 as absence even after returning to origin (return=%s)", async returned => {
        const { client } = fixture([redirect("https://cdn.example.test/object"), ...(returned ? [redirect(`${origin}/dav/returned`)] : []), { status: 404 }]);
        await expect(client.readSyncFile(name, true)).rejects.toMatchObject({ code: "NOT_FOUND", details: { status: 404 } });
    });

    it("keeps ordinary downloads strict about same-origin 404", async () => {
        await expect(fixture([{ status: 404 }]).client.readSyncFile(name)).rejects.toMatchObject({ code: "NOT_FOUND" });
        await expect(fixture([{ status: 404 }]).client.getFileContent("backup.json")).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it.each([401, 403])("preserves HTTP %i for the sync authentication pause", async status => {
        const { client } = fixture([redirect("https://cdn.example.test/object"), { status }]);
        await expect(client.readSyncFile(name, true)).rejects.toMatchObject({ code: "AUTH_REQUIRED", details: { status } });
    });
});
