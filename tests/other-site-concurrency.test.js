import { describe, expect, it } from "vitest";
import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import { mapLimit } from "../src/core/feature-helpers.js";

const otherSite = readTestFile(join(process.cwd(), "src/plugins/external-search/other-site.js"), "utf8");

describe("OtherSite concurrency policy", () => {
    it("runs site detection through mapLimit with a bounded worker count", () => {
        expect(otherSite).toContain("mapLimit(configs, 4,");
        expect(otherSite).toContain("mapLimit(view.configs, 4,");
    });

    it("mapLimit never exceeds the requested concurrency", async () => {
        let active = 0, max = 0;
        const results = await mapLimit([1, 2, 3, 4, 5, 6, 7, 8], 4, async (value) => {
            active++; max = Math.max(max, active);
            await new Promise((resolve) => setTimeout(resolve, 5));
            active--;
            return value * 2;
        });
        expect(results).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
        expect(max).toBeLessThanOrEqual(4);
    });
});
