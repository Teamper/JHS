// @vitest-environment jsdom

import jquery from "jquery";
import { describe, expect, it } from "vitest";
import { createJavBusAdapter } from "../../src/integrations/javbus/manifest.js";
import { parseJavBusMovieRef } from "../../src/integrations/javbus/parser.js";

describe("javbus malformed response", () => {
    it("rejects a response without an identifier", () => {
        document.body.replaceChildren();
        expect(() => parseJavBusMovieRef(jquery(window), "https://www.javbus.com/")).toThrow(/identifier/);
    });

    it("rejects invalid references before requesting a provider", async () => {
        const adapter = createJavBusAdapter({ request: async () => { throw new Error("must not request"); } });
        await expect(adapter.getDetail({ carNum: "" })).rejects.toThrow(/reference/);
    });
});
