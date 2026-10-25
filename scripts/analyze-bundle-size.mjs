import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { buildUserscript, repoRoot } from "./build.mjs";
import { createDevTransforms } from "./dev-metadata.mjs";
import { evaluateBundleBudget, formatBundleBudget, validateBundleBudget } from "./bundle-budget.mjs";

export async function analyzeBundleSize({ outputDirectory = join(repoRoot, "output", "static-resource-size") } = {}) {
    const budget = JSON.parse(await readFile(join(repoRoot, "performance-budget.json"), "utf8"));
    validateBundleBudget(budget.bundle);
    const commit = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: repoRoot, encoding: "utf8" }).trim() ? ".dirty" : "";
    const version = `7.0.0-dev.${new Date().toISOString().replace(/\D/g, "").slice(0, 12)}`;
    const transforms = createDevTransforms(version, commit + dirty);
    await mkdir(outputDirectory, { recursive: true });
    const unpackedPath = join(outputDirectory, "unpacked.user.js"), packedPath = join(outputDirectory, "packed.user.js");
    const unpacked = await buildUserscript({ ...transforms, outputPaths: [unpackedPath] });
    const packed = await buildUserscript({ ...transforms, outputPaths: [packedPath], packStaticResources: true });
    const unpackedBudget = evaluateBundleBudget(unpacked.outputBytes, budget.bundle);
    const packedBudget = evaluateBundleBudget(packed.outputBytes, budget.bundle);
    const savedBytes = unpacked.outputBytes - packed.outputBytes;
    const report = {
        version, buildId: commit + dirty, node: process.version,
        unpackedPath, packedPath, unpackedBytes: unpacked.outputBytes, packedBytes: packed.outputBytes,
        savedBytes, savedPercent: Number((savedBytes / unpacked.outputBytes * 100).toFixed(2)),
        softLimitBytes: budget.bundle.softLimitBytes, hardLimitBytes: budget.bundle.hardLimitBytes,
        unpackedBudget, packedBudget,
        // Preserve the legacy hard-limit fields for report consumers.
        maximumBytes: budget.bundle.hardLimitBytes, withinBudget: packedBudget.status !== "exceeded",
        unpackedGzipBytes: gzipSync(unpacked.output, { level: 9 }).length,
        packedGzipBytes: gzipSync(packed.output, { level: 9 }).length,
        packing: packed.analysis.packing, moduleContributions: unpacked.analysis.modules,
    };
    const reportPath = join(outputDirectory, "size-report.json");
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
    return { ...report, reportPath };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    const report = await analyzeBundleSize();
    console.log(`Same-metadata Dev: ${report.unpackedBytes} -> ${report.packedBytes} bytes; saved ${report.savedBytes} (${report.savedPercent}%)`);
    console.log(formatBundleBudget("unpacked", report.unpackedBudget));
    console.log(formatBundleBudget("packed", report.packedBudget));
    console.log(`Report: ${report.reportPath}`);
}
