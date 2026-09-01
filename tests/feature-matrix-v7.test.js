import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { featureManifests } from "../src/features/catalog.js";

const matrixPath = path.resolve(import.meta.dirname, "../docs/architecture/feature-matrix-v7.md");

function parseRows(source) {
  return new Map([...source.matchAll(/^\| `([^`]+)` \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)].map((match) => [match[1], match.slice(2).map((value) => value.trim())]));
}

describe("7.0 feature matrix", () => {
  it("keeps the architecture matrix synchronized with feature manifests", async () => {
    const rows = parseRows(await readFile(matrixPath, "utf8"));
    expect([...rows.keys()]).toEqual(featureManifests.map((manifest) => manifest.id));
    for (const manifest of featureManifests) {
      const row = rows.get(manifest.id);
      expect(row?.[0], `${manifest.id} kind`).toBe(manifest.kind);
      expect(row?.[2], `${manifest.id} startup`).toBe(manifest.startup);
      expect(row?.[3], `${manifest.id} contributions`).toBe(manifest.contributes.length ? manifest.contributes.map((id) => `\`${id}\``).join(", ") : "—");
    }
  });
});
