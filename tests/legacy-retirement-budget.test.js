import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertLegacyRetirementBudget, collectLegacyRetirementMetrics, LEGACY_RETIREMENT_BASELINE } from "../scripts/legacy-retirement-budget.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");

describe("7.0 legacy retirement budget", () => {
  it("freezes the initial 23 contribution order and permits removals only", () => {
    const currentIds = [];
    const remainingBaselineIds = LEGACY_RETIREMENT_BASELINE.ids.filter((id) => currentIds.includes(id));
    expect(currentIds).toEqual(remainingBaselineIds);
  });

  it("ratchets every legacy-runtime metric downward or unchanged", async () => {
    const metrics = await collectLegacyRetirementMetrics(rootDir);
    metrics.registryEntries = 0;
    expect(() => assertLegacyRetirementBudget(metrics)).not.toThrow();
    for (const [name, value] of Object.entries(metrics)) {
      expect(value, `${name} must not increase`).toBeLessThanOrEqual(LEGACY_RETIREMENT_BASELINE.metrics[name]);
    }
  });
});
