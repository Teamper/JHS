import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { analyzeBundleSize } from "../scripts/analyze-bundle-size.mjs";
import { buildUserscript } from "../scripts/build.mjs";

// Simulate build sizes at the compiler boundary; budget evaluation, gzip and report I/O stay real.
vi.mock("../scripts/build.mjs", async importOriginal => ({
    ...await importOriginal(), buildUserscript: vi.fn(),
}));

const scratchRoots = [];
afterEach(async () => {
    vi.clearAllMocks();
    for (const root of scratchRoots.splice(0)) {
        if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw new Error("Unsafe scratch path");
        await rm(root, { recursive: true, force: true });
    }
});

function artifact(sizeBytes, packed) {
    const output = "x".repeat(sizeBytes);
    return {
        output, outputBytes: sizeBytes, outputPaths: [],
        analysis: {
            outputBytes: sizeBytes, sha256: createHash("sha256").update(output).digest("hex"),
            packStaticResources: packed, unpackedBodyBytes: sizeBytes,
            packing: { resourceCount: packed ? 1 : 0 },
            modules: [{ path: "src/example.js", unpackedBytes: sizeBytes }],
        },
    };
}

describe("bundle analysis budget report", () => {
    it.each([
        [1700000, 1500000, "warning", "ok", true, 300000, 500000],
        [2100000, 2000000, "exceeded", "warning", true, -100000, 0],
        [2100000, 2000001, "exceeded", "exceeded", false, -100000, -1],
    ])("evaluates unpacked %i and packed %i independently", async (unpackedBytes, packedBytes, unpackedStatus, packedStatus, withinBudget, unpackedRemaining, packedRemaining) => {
        const outputDirectory = await mkdtemp(join(tmpdir(), "jhs-bundle-analysis-"));
        scratchRoots.push(outputDirectory);
        buildUserscript.mockImplementation(async options => artifact(options.packStaticResources ? packedBytes : unpackedBytes, Boolean(options.packStaticResources)));
        const report = await analyzeBundleSize({ outputDirectory });
        expect(report).toMatchObject({
            softLimitBytes: 1600000, hardLimitBytes: 2000000, maximumBytes: 2000000, withinBudget,
            unpackedBudget: { sizeBytes: unpackedBytes, status: unpackedStatus, remainingHardBytes: unpackedRemaining },
            packedBudget: { sizeBytes: packedBytes, status: packedStatus, remainingHardBytes: packedRemaining },
        });
        const saved = JSON.parse(await readFile(report.reportPath, "utf8"));
        expect(saved.unpackedBudget).toEqual(report.unpackedBudget);
        expect(saved.packedBudget).toEqual(report.packedBudget);
        expect(saved.unpackedGzipBytes).toBeGreaterThan(0);
        expect(saved.packedGzipBytes).toBeGreaterThan(0);
        expect(saved.moduleContributions).toEqual([{ path: "src/example.js", unpackedBytes }]);
        expect(saved.packing).toEqual({ resourceCount: 1 });
    });
});
