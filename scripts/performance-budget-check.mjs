import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const budget = JSON.parse(await readFile(path.join(rootDir, "performance-budget.json"), "utf8"));
if (!budget.browserFixture?.startupBaselineReason) throw new Error("Fixture startup baseline changes require a reason");
if (!budget.browserFixture?.ciStartupBaselineReason) throw new Error("CI fixture startup baseline changes require a reason");
for (const label of Object.keys(budget.browserFixture.maximumInitialRequests || {})) {
    const baseline = budget.browserFixture.startupMedianMilliseconds?.[label];
    if (!Number.isFinite(baseline) || baseline <= 0) throw new Error(`Missing positive fixture startup baseline for ${label}`);
    const ciBaseline = budget.browserFixture.ciStartupMedianMilliseconds?.[label];
    if (!Number.isFinite(ciBaseline) || ciBaseline <= 0) throw new Error(`Missing positive CI fixture startup baseline for ${label}`);
}
console.log(`Fixture budget configuration validated (runtime measurements run separately): requests ${JSON.stringify(budget.browserFixture.maximumInitialRequests)}; Windows Edge startup medians ${JSON.stringify(budget.browserFixture.startupMedianMilliseconds)}ms; GitHub Ubuntu Chromium startup medians ${JSON.stringify(budget.browserFixture.ciStartupMedianMilliseconds)}ms`);
