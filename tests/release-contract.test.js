import { describe, expect, it } from "vitest";
import {
  compareStableVersions,
  decideRelease,
  extractReleaseNotes,
  parseStableVersion,
  validateReleaseContract
} from "../scripts/release-contract.mjs";

function makeContract(overrides = {}) {
  const version = overrides.version ?? "6.3.0";
  return {
    packageSource: JSON.stringify({ version }),
    lockSource: JSON.stringify({ version, packages: { "": { version } } }),
    mainSource: `// ==UserScript==\n// @version      ${version}\n// ==/UserScript==`,
    outputSource: `// ==UserScript==\n// @version      ${version}\n// ==/UserScript==`,
    changelogSource: `# Changelog\n\n## [Unreleased]\n\n## [${version}](../../compare/v6.2.1...v${version}) - 2026-08-22\n\n### Changed\n\n- Release notes.\n\n## [6.2.1]\n\n- Older notes.`,
    ...overrides
  };
}

describe("release contract", () => {
  it("accepts one consistent stable version and extracts its notes", () => {
    const contract = validateReleaseContract(makeContract());
    expect(contract.version).toBe("6.3.0");
    expect(contract.notes).toContain("Release notes.");
    expect(contract.notes).not.toContain("Older notes.");
  });

  it.each([
    ["top-level lock version", { lockSource: JSON.stringify({ version: "6.2.1", packages: { "": { version: "6.3.0" } } }) }],
    ["root lock version", { lockSource: JSON.stringify({ version: "6.3.0", packages: { "": { version: "6.2.1" } } }) }],
    ["source metadata", { mainSource: "// @version 6.2.1" }],
    ["built metadata", { outputSource: "// @version 6.2.1" }]
  ])("rejects a mismatched %s", (_label, override) => {
    expect(() => validateReleaseContract(makeContract(override))).toThrow(/does not match/);
  });

  it.each(["6.3", "v6.3.0", "6.3.0-beta.1", "06.3.0"])("rejects non-stable version %s", (version) => {
    expect(() => parseStableVersion(version)).toThrow(/stable X\.Y\.Z/);
  });

  it("requires exactly one userscript version declaration", () => {
    expect(() => validateReleaseContract(makeContract({ mainSource: "// no version" }))).toThrow(/exactly one @version/);
    expect(() => validateReleaseContract(makeContract({ mainSource: "// @version 6.3.0\n// @version 6.3.0" }))).toThrow(/exactly one @version/);
  });

  it("requires one non-empty changelog section for the current version", () => {
    expect(() => extractReleaseNotes("## [Unreleased]\n", "6.3.0")).toThrow(/exactly one section/);
    expect(() => extractReleaseNotes("## [6.3.0]\n\n## [6.2.1]\n- Old", "6.3.0")).toThrow(/must not be empty/);
  });
});

describe("release decision", () => {
  it("compares stable versions numerically", () => {
    expect(compareStableVersions("6.10.0", "6.9.9")).toBe(1);
    expect(compareStableVersions("6.3.0", "6.3.0")).toBe(0);
    expect(compareStableVersions("6.2.9", "6.3.0")).toBe(-1);
  });

  it("skips unchanged versions and releases increased versions", () => {
    expect(decideRelease("6.3.0", { previousVersion: "6.3.0" })).toBe(false);
    expect(decideRelease("6.3.1", { previousVersion: "6.3.0" })).toBe(true);
  });

  it("rejects version rollback but permits explicit recovery", () => {
    expect(() => decideRelease("6.2.1", { previousVersion: "6.3.0" })).toThrow(/must increase/);
    expect(decideRelease("6.3.0", { forceRelease: true })).toBe(true);
  });
});
