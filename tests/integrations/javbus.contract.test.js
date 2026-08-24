// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import jquery from "jquery";
import { describe, expect, it, vi } from "vitest";
import { createJavBusAdapter } from "../../src/integrations/javbus/manifest.js";
import { parseJavBusMovieDetail, parseJavBusMovieRef } from "../../src/integrations/javbus/parser.js";
import { CacheService } from "../../src/services/cache-service.js";
import { ExternalUrlPolicy } from "../../src/services/external-url-policy.js";
import { HttpService } from "../../src/services/http-service.js";

const fixture = readFileSync(join(import.meta.dirname, "../fixtures/integrations/javbus/detail.html"), "utf8");

describe("javbus normalized contract", () => {
    it("returns a MovieRef from the fixture", () => {
        document.documentElement.innerHTML = fixture;
        expect(parseJavBusMovieRef(jquery(window), "https://www.javbus.com/ABC-123")).toEqual({ carNum: "ABC-123", url: "https://www.javbus.com/ABC-123" });
    });

    it("normalizes remote detail and cover contracts", () => {
        expect(parseJavBusMovieDetail(fixture, "https://www.javbus.com/ABC-123")).toMatchObject({
            carNum: "ABC-123", title: "ABC-123 Fixture title", coverUrl: "https://www.javbus.com/covers/abc-123.jpg", providerId: "javbus",
        });
    });

    it("deduplicates concurrent detail and image consumers", async () => {
        const request = vi.fn(async options => ({ status: 200, data: fixture, finalUrl: options.url }));
        const http = new HttpService({ request }, new ExternalUrlPolicy(), { cache: new CacheService() });
        const adapter = createJavBusAdapter(http);
        const [detail, images] = await Promise.all([
            adapter.getDetail({ carNum: "ABC-123" }), adapter.getImages({ carNum: "ABC-123" }),
        ]);
        expect(detail.title).toBe("ABC-123 Fixture title");
        expect(images).toEqual([{ url: "https://www.javbus.com/covers/abc-123.jpg", providerId: "javbus" }]);
        expect(request).toHaveBeenCalledOnce();
    });
});
