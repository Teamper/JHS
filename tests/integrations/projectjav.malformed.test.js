// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseProjectJavSearch, parseProjectJavImages } from "../../src/integrations/projectjav/parser.js";
const fixture = name => readFileSync(join(import.meta.dirname, `../fixtures/integrations/projectjav/${name}.html`), "utf8");
const detailUrl = "https://projectjav.com/movie/ssis-001-79945";
describe("projectjav malformed and identity boundaries", () => {
    it("rejects challenges and non-HTML payloads", () => {
        expect(() => parseProjectJavSearch("<title>Just a moment</title>", "SSIS-001", detailUrl)).toThrow();
        expect(() => parseProjectJavImages(null, "SSIS-001", detailUrl)).toThrow();
    });
    it("rejects adjacent and mixed movie identities", () => {
        expect(parseProjectJavImages(fixture("detail"), "SSIS-002", detailUrl)).toEqual([]);
        expect(parseProjectJavImages(fixture("detail").replace("SSIS-001 fixture", "SSIS-001 SSIS-002 fixture"), "SSIS-001", detailUrl)).toEqual([]);
        expect(parseProjectJavSearch(fixture("search").replaceAll("ssis-001", "ssis-0010").replaceAll("SSIS-001", "SSIS-0010"), "SSIS-001", detailUrl)).toEqual([]);
    });
    it("rejects external and credential-bearing search links", () => {
        expect(parseProjectJavSearch(fixture("search").replace(/href="[^"]*"/, 'href="https://evil.example/movie/ssis-001-79945"'), "SSIS-001", detailUrl)).toEqual([]);
        expect(parseProjectJavSearch(fixture("search").replace(/href="[^"]*"/, 'href="https://name:secret@projectjav.com/202569/ssis-001"'), "SSIS-001", detailUrl)).toEqual([]);
    });
});
