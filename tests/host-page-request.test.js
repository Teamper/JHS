import { describe, expect, it, vi } from "vitest";
import { requestHostPage } from "../src/core/host-page-request.js";

describe("host page request", () => {
    it("uses HttpService with the current HTTPS host and lifecycle scope", async () => {
        const previousWindow = globalThis.window;
        const scope = {}, request = vi.fn(async () => ({ status: 200, data: "<main>ok</main>" }));
        globalThis.window = { location: new URL("https://javdb.com/list") };
        try {
            await expect(requestHostPage({ request }, "/page/2", scope)).resolves.toBe("<main>ok</main>");
            expect(request).toHaveBeenCalledWith({
                providerId: "host-page",
                method: "GET",
                url: "https://javdb.com/page/2",
                responseType: "text",
                cacheScope: "none",
                urlPolicy: { trustClass: "builtin-public", hosts: ["javdb.com"], expectedOrigin: "https://javdb.com" },
            }, scope);
        } finally {
            globalThis.window = previousWindow;
        }
    });
});
