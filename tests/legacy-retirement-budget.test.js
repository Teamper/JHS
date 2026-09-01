import path from "node:path";
import { describe, expect, it } from "vitest";
import { access } from "node:fs/promises";
import { assertLegacyRetirementBudget, collectLegacyRetirementMetrics, LEGACY_RETIREMENT_BASELINE, LEGACY_RUNTIME_PATHS } from "../scripts/legacy-retirement-budget.mjs";

const rootDir = path.resolve(import.meta.dirname, "..");

describe("7.0 legacy retirement budget", () => {
  it("seals every legacy-runtime metric at exactly zero", async () => {
    expect(LEGACY_RETIREMENT_BASELINE.metrics).toEqual({
      registryEntries: 0,
      basePluginSubclasses: 0,
      optionalDependencyCallsites: 0,
      resolveLegacyContributionCallsites: 0,
      legacyDependencyEdges: 0,
      unsafeWindowLegacyExports: 0,
    });
    const metrics = await collectLegacyRetirementMetrics(rootDir);
    expect(metrics).toEqual(LEGACY_RETIREMENT_BASELINE.metrics);
    expect(() => assertLegacyRetirementBudget({ ...metrics, registryEntries: 1 })).toThrow(/registryEntries must remain exactly 0/);
  });

  it("keeps every retired legacy runtime file absent", async () => {
    for (const relativePath of LEGACY_RUNTIME_PATHS) {
      await expect(access(path.join(rootDir, relativePath))).rejects.toMatchObject({ code: "ENOENT" });
    }
  });
});
