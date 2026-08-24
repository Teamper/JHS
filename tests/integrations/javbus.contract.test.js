// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import jquery from "jquery";
import { describe, expect, it } from "vitest";
import { parseJavBusMovieRef } from "../../src/integrations/javbus/parser.js";

describe("javbus normalized contract", () => {
    it("returns a MovieRef from the fixture", () => {
        document.documentElement.innerHTML = readFileSync(join(import.meta.dirname, "../fixtures/integrations/javbus/detail.html"), "utf8");
        expect(parseJavBusMovieRef(jquery(window), "https://www.javbus.com/ABC-123")).toEqual({ carNum: "ABC-123", url: "https://www.javbus.com/ABC-123" });
    });
});
