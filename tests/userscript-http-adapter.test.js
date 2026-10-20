import { describe, expect, it, vi } from "vitest";
import { UserscriptHttpAdapter } from "../src/platform/userscript/userscript-http-adapter.js";

describe("UserscriptHttpAdapter", () => {
    it("marks dispatch only at the GM boundary and lets a preflight callback refuse it", async () => {
        const order = [], onDispatch = vi.fn(() => order.push("dispatch"));
        const request = vi.fn(options => { order.push("gm"); options.onload({ status: 200 }); });
        const adapter = new UserscriptHttpAdapter(request);
        await adapter.request({ url: "https://example.test/task", onDispatch });
        expect(order).toEqual(["dispatch", "gm"]);
        const cancelled = new AbortController(); cancelled.abort();
        await expect(adapter.request({ url: "https://example.test/task", onDispatch, signal: cancelled.signal })).rejects.toMatchObject({ code: "ABORTED" });
        expect(onDispatch).toHaveBeenCalledOnce();
        const failure = Object.assign(new Error("disabled"), { code: "SERVICE_DISABLED" });
        await expect(adapter.request({ url: "https://example.test/task", onDispatch: () => { throw failure; } })).rejects.toBe(failure);
        expect(request).toHaveBeenCalledOnce();
    });

    it("never falls back or replays a mutation carrying a dispatch callback", async () => {
        const native = vi.fn(), onDispatch = vi.fn();
        const request = vi.fn(options => options.ontimeout());
        await expect(new UserscriptHttpAdapter(request, native).request({ method: "POST", url: "https://example.test/task", transport: "native-fetch", onDispatch })).rejects.toMatchObject({ code: "TIMEOUT" });
        expect(native).not.toHaveBeenCalled();
        expect(request).toHaveBeenCalledOnce();
        expect(onDispatch).toHaveBeenCalledOnce();
    });

    it.each([{}, { redirect: "manual" }, { anonymous: true }, { fetch: true }])("times out a silent GM request independently of native callbacks (%j)", async requestOptions => {
        vi.useFakeTimers();
        try {
            let callbacks;
            const abort = vi.fn(() => callbacks.onabort());
            const request = vi.fn(options => { callbacks = options; return { abort }; });
            const pending = new UserscriptHttpAdapter(request).request({ url: "https://example.test/file", timeout: 10_000, requestOptions });
            const rejected = expect(pending).rejects.toMatchObject({ code: "TIMEOUT" });
            await vi.advanceTimersByTimeAsync(9_999);
            expect(abort).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(1);
            await rejected;
            expect(abort).toHaveBeenCalledOnce();
            callbacks.onload({ status: 200, responseText: "late", finalUrl: callbacks.url });
            callbacks.onerror(new Error("late"));
            callbacks.ontimeout();
            expect(abort).toHaveBeenCalledOnce();
            expect(vi.getTimerCount()).toBe(0);
        } finally { vi.useRealTimers(); }
    });

    it("cleans up its timer after success just before the deadline", async () => {
        vi.useFakeTimers();
        try {
            const abort = vi.fn();
            const request = options => { setTimeout(() => options.onload({ status: 200, responseText: "ok" }), 9_999); return { abort }; };
            const pending = new UserscriptHttpAdapter(request).request({ url: "https://example.test/file", timeout: 10_000 });
            await vi.advanceTimersByTimeAsync(9_999);
            await expect(pending).resolves.toMatchObject({ data: "ok" });
            await vi.advanceTimersByTimeAsync(1);
            expect(abort).not.toHaveBeenCalled();
            expect(vi.getTimerCount()).toBe(0);
        } finally { vi.useRealTimers(); }
    });

    it.each(["success", "error", "throw", "abort"])("cleans timer and signal listener after synchronous %s", async outcome => {
        vi.useFakeTimers();
        try {
            const controller = new AbortController(), remove = vi.spyOn(controller.signal, "removeEventListener"), abort = vi.fn();
            const request = options => {
                if (outcome === "success") options.onload({ status: 200, responseText: "ok" });
                if (outcome === "error") options.onerror(new Error("failed"));
                if (outcome === "throw") throw new Error("failed");
                if (outcome === "abort") controller.abort();
                return { abort };
            };
            const pending = new UserscriptHttpAdapter(request).request({ url: "https://example.test/file", timeout: 10_000, signal: controller.signal });
            if (outcome === "success") await expect(pending).resolves.toMatchObject({ data: "ok" });
            else await expect(pending).rejects.toMatchObject({ code: outcome === "abort" ? "ABORTED" : "NETWORK_ERROR" });
            expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
            expect(vi.getTimerCount()).toBe(0);
            expect(abort).toHaveBeenCalledTimes(outcome === "abort" ? 1 : 0);
        } finally { vi.useRealTimers(); }
    });

    it("does not start a GM request for an already cancelled signal", async () => {
        const controller = new AbortController(), request = vi.fn();
        controller.abort();
        await expect(new UserscriptHttpAdapter(request).request({ url: "https://example.test/file", signal: controller.signal, timeout: 10_000 })).rejects.toMatchObject({ code: "ABORTED" });
        expect(request).not.toHaveBeenCalled();
    });

    it("cancels a running GM request once and ignores its late callbacks", async () => {
        const controller = new AbortController();
        let callbacks;
        const abort = vi.fn(() => callbacks.onabort());
        const pending = new UserscriptHttpAdapter(options => { callbacks = options; return { abort }; }).request({ url: "https://example.test/file", signal: controller.signal, timeout: 10_000 });
        controller.abort();
        await expect(pending).rejects.toMatchObject({ code: "ABORTED" });
        callbacks.onload({ status: 200, responseText: "late" });
        expect(abort).toHaveBeenCalledOnce();
    });

    it("passes declared userscript request options without allowing core fields to be overridden", async () => {
        const request = vi.fn(options => {
            options.onload({ status: 200, responseText: "ok", finalUrl: options.url });
            return { abort: vi.fn() };
        });
        const response = await new UserscriptHttpAdapter(request).request({
            method: "GET", url: "https://123av.com/cn/search", responseType: "text",
            requestOptions: { cookiePartition: { topLevelSite: "https://123av.com" }, method: "POST", url: "https://invalid.example" },
        });
        expect(response.data).toBe("ok");
        expect(request).toHaveBeenCalledWith(expect.objectContaining({
            method: "GET", url: "https://123av.com/cn/search", cookiePartition: { topLevelSite: "https://123av.com" },
        }));
    });

    it("uses native fetch for latency-sensitive public requests", async () => {
        const request = vi.fn(), nativeFetch = vi.fn(async url => ({
            status: 200, url, headers: new Headers({ "content-type": "application/json" }),
            text: async () => JSON.stringify({ translation: "译文" }),
        }));
        const response = await new UserscriptHttpAdapter(request, nativeFetch).request({
            method: "GET", url: "https://translate-pa.googleapis.com/v1/translate", responseType: "json", transport: "native-fetch",
        });
        expect(response.data).toEqual({ translation: "译文" });
        expect(response).toMatchObject({ transportUsed: "native-fetch" });
        expect(nativeFetch).toHaveBeenCalledOnce();
        expect(nativeFetch).toHaveBeenCalledWith("https://translate-pa.googleapis.com/v1/translate", expect.objectContaining({ credentials: "same-origin" }));
        expect(request).not.toHaveBeenCalled();
    });

    it("falls back to GM requests when native fetch is unavailable for the origin", async () => {
        const request = vi.fn(options => {
            options.onload({ status: 200, response: { translation: "回退译文" }, responseText: '{"translation":"回退译文"}', finalUrl: options.url });
            return { abort: vi.fn() };
        }), nativeFetch = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
        const response = await new UserscriptHttpAdapter(request, nativeFetch).request({
            method: "GET", url: "https://translate-pa.googleapis.com/v1/translate", responseType: "json", transport: "native-fetch",
        });
        expect(response.data).toEqual({ translation: "回退译文" });
        expect(response).toMatchObject({ transportUsed: "gm", nativeFallbackCode: "NETWORK_ERROR" });
        expect(request).toHaveBeenCalledOnce();
    });

    it("aborts a hung native request at its own deadline and falls back exactly once", async () => {
        vi.useFakeTimers();
        try {
            const request = vi.fn(options => {
                options.onload({ status: 200, response: { translation: "超时回退" }, finalUrl: options.url });
                return { abort: vi.fn() };
            });
            const nativeFetch = vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })));
            const pending = new UserscriptHttpAdapter(request, nativeFetch).request({
                url: "https://translate-pa.googleapis.com/v1/translate", responseType: "json", transport: "native-fetch", nativeTimeout: 1_500, timeout: 5_000,
            });
            await vi.advanceTimersByTimeAsync(1_500);
            await expect(pending).resolves.toMatchObject({ data: { translation: "超时回退" } });
            expect(request).toHaveBeenCalledOnce();
        } finally { vi.useRealTimers(); }
    });

    it("does not fall back when the lifecycle aborts the native request", async () => {
        const request = vi.fn(), controller = new AbortController();
        const nativeFetch = vi.fn((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })));
        const pending = new UserscriptHttpAdapter(request, nativeFetch).request({
            url: "https://translate-pa.googleapis.com/v1/translate", transport: "native-fetch", nativeTimeout: 1_500, signal: controller.signal,
        });
        controller.abort();
        await expect(pending).rejects.toMatchObject({ code: "ABORTED" });
        expect(request).not.toHaveBeenCalled();
    });
});
