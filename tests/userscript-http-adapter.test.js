import { describe, expect, it, vi } from "vitest";
import { UserscriptHttpAdapter } from "../src/platform/userscript/userscript-http-adapter.js";

describe("UserscriptHttpAdapter", () => {
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

    it("passes the controlled redirect strategy to the userscript transport", async () => {
        const request = vi.fn(options => {
            options.onload({ status: 200, responseText: "ok", finalUrl: options.url });
            return { abort: vi.fn() };
        });
        await new UserscriptHttpAdapter(request).request({
            method: "GET", url: "https://api.example.test/data", redirect: "manual",
        });
        expect(request).toHaveBeenCalledWith(expect.objectContaining({ redirect: "manual" }));
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
        expect(nativeFetch).toHaveBeenCalledOnce();
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
