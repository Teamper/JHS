import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const budget = JSON.parse(await readFile(path.join(rootDir, "performance-budget.json"), "utf8"));
if (!budget.bundle?.reason) throw new Error("Bundle budget changes require a reason");
const size = (await stat(path.join(rootDir, "JHS.user.js"))).size;
const maximum = Math.floor(budget.bundle.baselineBytes * (1 + budget.bundle.maximumGrowthRatio));
if (size > maximum) throw new Error(`Bundle ${size} bytes exceeds the reviewed budget ${maximum} bytes`);
console.log(`Performance budget passed: bundle ${size}/${maximum} bytes; fixture request budgets ${JSON.stringify(budget.browserFixture.maximumInitialRequests)}`);
