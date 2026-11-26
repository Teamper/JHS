import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { HttpService, isCloudflareChallenge } from "../src/services/http-service.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { UserscriptHttpAdapter } from "../src/platform/userscript/userscript-http-adapter.js";

describe("HTTP Cloudflare detection", () => {
    it.each([
        ["ordinary page challenge-platform", 200, false],
        ["ordinary page cf-chl-token", 200, false],
        ["<title>Just a moment...</title>", 200, true],
        ["cf-chl-token /cdn-cgi/challenge-platform/", 403, true],
    ])("classifies %s with status %s", (html, status, blocked) => {
        expect(isCloudflareChallenge(html, status)).toBe(blocked);
    });

    it("does not classify the normal 123AV listing fixture as a challenge", () => {
        const html = readFileSync(new URL("./fixtures/123av-cards.html", import.meta.url), "utf8");
        expect(isCloudflareChallenge(html, 200)).toBe(false);
    });
});

describe("GM request cookie partition", () => {
    it("adds the partition only when explicitly requested", async () => {
        const request = vi.fn(options => options.onload({ status: 200, responseText: "ok", finalUrl: options.url }));
        const adapter = new UserscriptHttpAdapter(request);
        await adapter.request({ url: "https://123av.com/cn/makers/fc2", requestOptions: { cookiePartition: { topLevelSite: "https://123av.com" } } });
        await adapter.request({ url: "https://javdb.com/" });
        expect(request.mock.calls[0][0].cookiePartition).toEqual({ topLevelSite: "https://123av.com" });
        expect(request.mock.calls[1][0]).not.toHaveProperty("cookiePartition");
    });

    it("preserves diagnostics and records one failure for a blocked response", async () => {
        const body = "cf-chl-token /cdn-cgi/challenge-platform/";
        const adapter = new UserscriptHttpAdapter(options => {
            options.onload({ status: 403, responseText: body, finalUrl: options.url });
        });
        const http = new HttpService(adapter, new ExternalUrlPolicy());
        await expect(http.request({
            providerId: "av123", url: "https://123av.com/cn/makers/fc2", retryCount: 0,
            urlPolicy: { trustClass: "builtin-public", hosts: ["123av.com"] },
        })).rejects.toMatchObject({ code: "CF_BLOCKED", details: { status: 403, domain: "123av.com", contentLength: body.length } });
        expect(http.getCircuitBreakerStatus()["123av.com"].failCount).toBe(1);
    });
});
