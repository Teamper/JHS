// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { Utils } from "../src/core/utils.js";

describe("dialog preset sizing", () => {
    it.each([
        ["small form width", 1440, 1000, "sm", ["480px", "640px"]],
        ["large settings size", 1440, 1000, "lg", ["1040px", "760px"]],
        ["extra-large table size", 1600, 1000, "xl", ["1320px", "860px"]],
        ["workspace width cap", 1920, 1200, "workspace", ["1440px", "960px"]],
        ["mobile workspace inset", 375, 700, "workspace", ["359px", "684px"]],
        ["medium fallback", 1200, 900, "unknown", ["720px", "700px"]],
    ])("uses the %s", (_label, width, height, preset, expected) => {
        vi.stubGlobal("innerWidth", width);
        vi.stubGlobal("innerHeight", height);
        try {
            expect(new Utils().getDialogArea(preset)).toEqual(expected);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
