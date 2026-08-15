import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const cases = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/media/cases.json"), "utf8"));
const helpers = readFileSync(join(import.meta.dirname, "../src/core/feature-helpers.js"), "utf8");
describe("media regression fixture matrix", () => {
    it("contains DMM, VR, FC2, uncensored and Mgstage branches", () => { for (const key of ["dmm", "vr", "fc2", "uncensored", "mgstage"]) expect(cases[key].length).toBeGreaterThan(0); });
    it("uses candidate CID and centralized cover resolution", () => { expect(helpers).toContain("function normalizeDmmCid"); expect(helpers).toContain("function resolveHighResCover"); expect(helpers).not.toMatch(/NKNKJDVAJ.*===|MCHT.*===/); });
});
