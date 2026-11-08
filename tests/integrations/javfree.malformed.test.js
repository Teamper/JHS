// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseJavFreeSearch, parseJavFreeImages } from "../../src/integrations/javfree/parser.js";
const fixture = name => readFileSync(join(import.meta.dirname, `../fixtures/integrations/javfree/${name}.html`), "utf8");
const detailUrl = "https://javfree.me/202569/ssis-001";
describe("javfree malformed and identity boundaries", () => {
    it("rejects challenges and non-HTML payloads", () => {
        expect(() => parseJavFreeSearch("<title>Just a moment</title>", "SSIS-001", detailUrl)).toThrow();
        expect(() => parseJavFreeImages(null, "SSIS-001", detailUrl)).toThrow();
    });
    it("rejects adjacent and mixed movie identities", () => {
        expect(parseJavFreeImages(fixture("detail"), "SSIS-002", detailUrl)).toEqual([]);
        expect(parseJavFreeImages(fixture("detail").replace("SSIS-001 fixture", "SSIS-001 SSIS-002 fixture"), "SSIS-001", detailUrl)).toEqual([]);
        expect(parseJavFreeSearch(fixture("search").replaceAll("ssis-001", "ssis-0010").replaceAll("SSIS-001", "SSIS-0010"), "SSIS-001", detailUrl)).toEqual([]);
    });
    it("rejects external and credential-bearing search links", () => {
        expect(parseJavFreeSearch(fixture("search").replace(/href="[^"]*"/, 'href="https://evil.example/movie/ssis-001-79945"'), "SSIS-001", detailUrl)).toEqual([]);
        expect(parseJavFreeSearch(fixture("search").replace(/href="[^"]*"/, 'href="https://name:secret@javfree.me/202569/ssis-001"'), "SSIS-001", detailUrl)).toEqual([]);
    });
});
