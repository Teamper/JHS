import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { buildUserscript } from "../scripts/build.mjs";

const digest = value => createHash("sha256").update(value).digest("hex");

describe("userscript static resource build contract", () => {
    it("keeps metadata, licenses and formal files while reducing the complete UTF-8 artifact", async () => {
        const paths = ["JHS.user.js", "dist/JHS.user.js"];
        const snapshotFormal = () => Promise.all(paths.map(async path => {
            try { return digest(await readFile(new URL(`../${path}`, import.meta.url))); }
            catch (error) {
                // A clean checkout has no ignored dist artifact; its absence must also be preserved.
                if (path === "dist/JHS.user.js" && error.code === "ENOENT") return null;
                throw error;
            }
        }));
        const before = await snapshotFormal();
        const transforms = {
            outputPaths: [],
            transformMetadata: metadata => metadata.replace(/^\/\/ @name\s+.+$/m, "// @name         JHS Dev 7.0"),
            transformBundle: code => 'document.documentElement?.setAttribute("data-jhs-dev-build", "fixture");\n' + code,
        };
        const control = await buildUserscript(transforms);
        const packed = await buildUserscript({ ...transforms, packStaticResources: true });
        expect(packed.outputBytes).toBe(Buffer.byteLength(packed.output, "utf8"));
        expect(packed.analysis.sha256).toBe(digest(packed.output));
        expect(packed.analysis.packStaticResources).toBe(true);
        expect(control.analysis.packStaticResources).toBe(false);
        expect(control.outputBytes - packed.outputBytes).toBeGreaterThan(90_000);
        expect(packed.output.match(/^\/\/ ==UserScript==[\s\S]*?^\/\/ ==\/UserScript==/m)[0]).toBe(control.output.match(/^\/\/ ==UserScript==[\s\S]*?^\/\/ ==\/UserScript==/m)[0]);
        expect(packed.output).toContain("data-jhs-dev-build");
        expect(packed.output).toContain("Lucide icons source:");
        expect(packed.output).toContain("fflate 0.8.3");
        expect(packed.output).toContain("MIT License");
        expect(packed.analysis.packing.resourceCount).toBeGreaterThan(0);
        expect(packed.analysis.modules.every(item => item.path.startsWith("src/"))).toBe(true);
        expect(() => new vm.Script(packed.output)).not.toThrow();
        const repeated = await buildUserscript({ ...transforms, packStaticResources: true });
        expect(repeated.output).toBe(packed.output);
        expect(await snapshotFormal()).toEqual(before);
    }, 20_000);
});
