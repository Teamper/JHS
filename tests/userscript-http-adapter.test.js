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
});
