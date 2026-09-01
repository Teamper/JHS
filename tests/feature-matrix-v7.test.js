import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { featureManifests } from "../src/features/catalog.js";

const canonicalMatrixPath = path.resolve(import.meta.dirname, "../docs/architecture/feature-matrix.md");

function parseRows(source) {
  return new Map(source.split(/\r?\n/).filter((line) => /^\| `[^`]+` \|/.test(line)).map((line) => {
    const cells = line.split("|").slice(1, -1).map((value) => value.trim());
    return [cells[0].slice(1, -1), cells.slice(1)];
  }));
}

describe("7.0 feature matrix", () => {
  it("freezes the complete feature and capability contract in the canonical matrix", async () => {
    const source = await readFile(canonicalMatrixPath, "utf8");
    expect(source).toContain("# JHS 7.0 Feature Matrix");
    for (const field of ["Feature", "Contribution", "Site", "Route", "Startup", "Failure policy", "Owner", "Entry trigger", "Disable semantics", "User-visible surface", "Automated proof", "Manual proof"]) {
      expect(source).toContain(`| ${field} |`);
    }
    expect(source).toContain("`list.fc2-navigation`");
    expect(source).toContain("`detail.fc2-owned`");
    expect(source).toContain("FeatureRuntime.runContribution()");
    expect(source).not.toContain("版本仍保持当前 `7.0.0`");
  });

  it("keeps the architecture matrix synchronized with feature manifests", async () => {
    const rows = parseRows(await readFile(canonicalMatrixPath, "utf8"));
    expect([...rows.keys()]).toEqual(featureManifests.map((manifest) => manifest.id));
    for (const manifest of featureManifests) {
      const row = rows.get(manifest.id);
      expect(row?.[0], `${manifest.id} contributions`).toBe(manifest.contributes.length ? manifest.contributes.map((id) => `\`${id}\``).join("; ") : "—");
      expect(row?.[2], `${manifest.id} route`).toBe(manifest.routes.length ? manifest.routes.join(", ") : "all");
      expect(row?.[3], `${manifest.id} startup`).toBe(manifest.startup);
    }
  });
});
