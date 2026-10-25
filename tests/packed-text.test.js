import { afterEach, describe, expect, it, vi } from "vitest";
import { deflateRawSync } from "node:zlib";
import { build } from "esbuild";
import vm from "node:vm";
import { createPackedTextReader } from "../src/core/packed-text.js";

const encode = value => deflateRawSync(Buffer.from(JSON.stringify(value))).toString("base64");

describe("embedded static text reader", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("restores Unicode, whitespace, CSS tokens and HTML attributes exactly", () => {
        const values = [
            '\uFEFF演员 😀\r\n  a\tb  \\"\u2028\u2029',
            '<style id="fixture">.parent .child{content:"a  b";width:calc(100% - 2px);--label: a b}</style>',
            '<label aria-label="演员 &amp; 影片"><input value="&quot; a  b"></label>',
        ];
        const read = createPackedTextReader(encode(values), values.length);
        expect(values.map((_, index) => read(index))).toEqual(values);
    });

    it("decodes lazily once and reuses the page-local resource table", () => {
        const original = globalThis.atob, decode = vi.fn(original);
        vi.stubGlobal("atob", decode);
        const read = createPackedTextReader(encode(["first", "second"]), 2);
        expect(decode).not.toHaveBeenCalled();
        expect(read(1)).toBe("second");
        expect(read(0)).toBe("first");
        expect(read(1)).toBe("second");
        expect(decode).toHaveBeenCalledOnce();
    });

    it.each(["not base64!", encode({}), encode([1]), encode(["wrong count"])])("rejects a corrupt or mismatched table: %s", payload => {
        expect(() => createPackedTextReader(payload, 2)(0)).toThrow(/static text/i);
    });

    it.each([-1, 2, 0.5, NaN, "0"])("rejects an invalid resource index: %s", index => {
        expect(() => createPackedTextReader(encode(["a", "b"]), 2)(index)).toThrow(RangeError);
    });

    it("works without the native TextDecoder or compression-stream APIs", async () => {
        const bundle = await build({
            stdin: { contents: 'export { createPackedTextReader } from "./src/core/packed-text.js";', resolveDir: process.cwd() },
            bundle: true, write: false, format: "iife", globalName: "Reader", target: "es2020", logLevel: "silent",
        });
        const sandbox = { atob, TextDecoder: undefined };
        vm.runInNewContext(bundle.outputFiles[0].text, sandbox);
        expect(sandbox.Reader.createPackedTextReader(encode(["演员 😀\n  原样"]), 1)(0)).toBe("演员 😀\n  原样");
    });
});
