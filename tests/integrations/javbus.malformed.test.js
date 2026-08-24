// @vitest-environment jsdom

import jquery from "jquery";
import { describe, expect, it } from "vitest";
import { parseJavBusMovieRef } from "../../src/integrations/javbus/parser.js";

describe("javbus malformed response", () => {
    it("rejects a response without an identifier", () => {
        document.body.replaceChildren();
        expect(() => parseJavBusMovieRef(jquery(window), "https://www.javbus.com/")).toThrow(/identifier/);
    });
});
