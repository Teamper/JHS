import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const httpSource = readFileSync(join(import.meta.dirname, "../src/core/http.js"), "utf8");

function loadHttp(onRequest = null) {
    const context = vm.createContext({
        URL,
        URLSearchParams,
        console,
        unsafeWindow: {},
        window: {},
        clog: { warn() {}, error() {} },
        Utils: class {},
        StorageManager: class {},
        storageManager: { getSetting: async (key, fallback) => fallback },
        utils: { retry: async (operation) => operation() },
        GM_xmlhttpRequest: (options) => onRequest?.(options)
    });
    vm.runInContext(httpSource, context);
    return context.window.gmHttp;
}

describe("HTTP Cloudflare detection", () => {
    const gmHttp = loadHttp();

    it("does not block isolated challenge-platform on HTTP 200", () => {
        expect(gmHttp._isCloudflareChallenge("ordinary page challenge-platform", 200)).toBe(false);
    });

    it("does not block isolated cf-chl- on HTTP 200", () => {
        expect(gmHttp._isCloudflareChallenge("ordinary page cf-chl-token", 200)).toBe(false);
    });

    it("blocks a Just a moment title", () => {
        expect(gmHttp._isCloudflareChallenge("<title>Just a moment...</title>", 200)).toBe(true);
    });

    it("blocks a complete challenge response on blocked status", () => {
        expect(gmHttp._isCloudflareChallenge("cf-chl-token /cdn-cgi/challenge-platform/", 403)).toBe(true);
    });

    it("does not classify the normal 123AV listing fixture as a challenge", () => {
        const html = readFileSync(join(import.meta.dirname, "fixtures/123av-cards.html"), "utf8");
        expect(gmHttp._isCloudflareChallenge(html, 200)).toBe(false);
    });
});

describe("GM request cookie partition", () => {
    it("adds the partition only when explicitly requested", async () => {
        const requests = [];
        const gmHttp = loadHttp((options) => {
            requests.push(options);
            options.onload({ status: 200, responseText: "ok", finalUrl: options.url });
        });
        await gmHttp.get("https://123av.com/cn/makers/fc2", {}, {}, false, {
            cookiePartitionTopLevelSite: "https://123av.com"
        });
        await gmHttp.get("https://javdb.com/");
        expect(requests[0].cookiePartition).toEqual({ topLevelSite: "https://123av.com" });
        expect(requests[1]).not.toHaveProperty("cookiePartition");
    });

    it("preserves diagnostics and records one failure for a blocked response", async () => {
        const gmHttp = loadHttp((options) => options.onload({
            status: 403,
            responseText: "cf-chl-token /cdn-cgi/challenge-platform/",
            finalUrl: options.url
        }));
        await expect(gmHttp.get("https://123av.com/cn/makers/fc2")).rejects.toMatchObject({
            _cfBlocked: true,
            status: 403,
            requestUrl: "https://123av.com/cn/makers/fc2",
            cfDiagnostics: { status: 403, contentLength: 41 }
        });
        expect(gmHttp.getCircuitBreakerStatus()["123av.com"].failCount).toBe(1);
    });
});
