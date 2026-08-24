import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const budget = JSON.parse(await readFile(path.join(rootDir, "performance-budget.json"), "utf8"));
if (!budget.bundle?.reason) throw new Error("Bundle budget changes require a reason");
if (!budget.browserFixture?.startupBaselineReason) throw new Error("Fixture startup baseline changes require a reason");
for (const label of Object.keys(budget.browserFixture.maximumInitialRequests || {})) {
    const baseline = budget.browserFixture.startupMedianMilliseconds?.[label];
    if (!Number.isFinite(baseline) || baseline <= 0) throw new Error(`Missing positive fixture startup baseline for ${label}`);
}
const size = (await stat(path.join(rootDir, "JHS.user.js"))).size;
const maximum = Math.floor(budget.bundle.baselineBytes * (1 + budget.bundle.maximumGrowthRatio));
if (size > maximum) throw new Error(`Bundle ${size} bytes exceeds the reviewed budget ${maximum} bytes`);
console.log(`Performance budget passed: bundle ${size}/${maximum} bytes; fixture request budgets ${JSON.stringify(budget.browserFixture.maximumInitialRequests)}; startup medians ${JSON.stringify(budget.browserFixture.startupMedianMilliseconds)}ms`);
