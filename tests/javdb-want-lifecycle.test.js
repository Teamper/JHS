// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { JavDbWantService } from "../src/services/javdb-want-service.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

function fixture(request = async () => ({ data: { data: { movies: [] } } })) {
    const credential = Object.assign(new EventTarget(), { revision: "A", value: "synthetic-A", readEntry: vi.fn(async () => ({ value: credential.value, revision: credential.revision })), remove: vi.fn(async () => {}) });
    const http = { request: vi.fn(request) };
    const service = new JavDbWantService({ credential, http, sign: () => "synthetic-signature" });
    return { service, credential, http };
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

describe("account-owned want-watch index", () => {
    it("retains the credential on a generic 403 permission or upstream block", async () => {
        const error = Object.assign(new Error("HTTP 403"), { code: "AUTH_REQUIRED", details: { status: 403 } });
        const f = fixture(async () => { throw error; });
        await expect(f.service.mark("one")).rejects.toBe(error);
        expect(f.credential.remove).not.toHaveBeenCalled();
        f.service.dispose();
    });
    it("shares one page across movies and never reuses account A results for B", async () => {
        const f = fixture(async () => ({ data: { data: { movies: [{ id: "one" }, { id: "two" }] } } }));
        await expect(Promise.all([f.service.get("one"), f.service.get("two")])).resolves.toEqual([true, true]);
        expect(f.http.request).toHaveBeenCalledOnce();
        f.credential.revision = "B"; f.credential.value = "synthetic-B";
        f.http.request.mockResolvedValueOnce({ data: { data: { movies: [] } } });
        await expect(f.service.get("one")).resolves.toBe(false);
        expect(f.http.request).toHaveBeenCalledTimes(2);
        f.service.dispose();
    });
    it("cancels one consumer without aborting another workspace's request", async () => {
        const gate = deferred(), a = new LifecycleScope("A"), b = new LifecycleScope("B");
        const f = fixture(() => gate.promise);
        const first = f.service.get("one", { scope: a }).catch(error => error), second = f.service.get("two", { scope: b });
        await vi.waitFor(() => expect(f.http.request).toHaveBeenCalledOnce());
        const requestScope = f.http.request.mock.calls[0][1];
        a.dispose();
        expect((await first).name).toBe("AbortError");
        expect(requestScope.disposed).toBe(false);
        gate.resolve({ data: { data: { movies: [{ id: "two" }] } } });
        await expect(second).resolves.toBe(true);
        b.dispose(); f.service.dispose();
    });
    it("aborts the underlying page when its last consumer closes", async () => {
        const scope = new LifecycleScope("last");
        const f = fixture((_options, requestScope) => new Promise((_, reject) => requestScope.signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), { once: true })));
        const pending = f.service.get("one", { scope }).catch(error => error);
        await vi.waitFor(() => expect(f.http.request).toHaveBeenCalledOnce());
        scope.dispose();
        expect((await pending).name).toBe("AbortError");
        expect(f.http.request.mock.calls[0][1].disposed).toBe(true);
        f.service.dispose();
    });
    it("reports unknown after the page bound and retains previously indexed pages", async () => {
        const f = fixture(async () => ({ data: { data: { movies: Array.from({ length: 48 }, (_, index) => ({ id: `other-${index}` })) } } }));
        await expect(f.service.get("missing")).resolves.toBeNull();
        await expect(f.service.get("another-missing")).resolves.toBeNull();
        expect(f.http.request).toHaveBeenCalledTimes(100);
        f.service.dispose();
    });
    it("ignores a response after the credential revision changed during lookup", async () => {
        const gate = deferred(), f = fixture(() => gate.promise);
        const result = f.service.get("one");
        await vi.waitFor(() => expect(f.http.request).toHaveBeenCalledOnce());
        f.credential.revision = "B";
        gate.resolve({ data: { data: { movies: [{ id: "one" }] } } });
        await expect(result).resolves.toBeNull();
        f.http.request.mockResolvedValueOnce({ data: { data: { movies: [] } } });
        await expect(f.service.get("one")).resolves.toBe(false);
        f.service.dispose();
    });
    it("does not retry a failed POST or remove a newer account on an old 401", async () => {
        const f = fixture(async () => { f.credential.revision = "B"; throw Object.assign(new Error("unauthorized"), { status: 401 }); });
        await expect(f.service.mark("one")).rejects.toMatchObject({ code: "LOGIN_REQUIRED" });
        expect(f.credential.remove).not.toHaveBeenCalled();
        expect(f.http.request).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ method: "POST", retryCount: 0, cacheScope: "none" }), undefined);
        f.service.dispose();
    });
});
