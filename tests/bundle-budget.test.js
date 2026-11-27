import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve, sep } from "node:path";
import { createDevTransforms } from "../scripts/dev-metadata.mjs";

const scratchRoots = [];
const scratchDirectory = fileURLToPath(new URL("../output", import.meta.url));
const bundle = {
    baselineBytes: 1170844, referenceBytes: 1170844, referenceCommit: "4ea5536",
    softLimitBytes: 1600000, hardLimitBytes: 2000000,
    reason: "7.0 uses absolute project budgets; 6.5 is historical context only",
};
const release = await readFile(new URL("../JHS.user.js", import.meta.url), "utf8");
const header = release.slice(0, release.indexOf("// ==/UserScript==") + "// ==/UserScript==".length);
const { transformMetadata, transformBundle } = createDevTransforms("7.0.0-dev.202611260000", "abcdef123456");
const dev = Buffer.from(`${transformMetadata(header)}\n${transformBundle("")}`);

afterEach(async () => {
    for (const root of scratchRoots.splice(0)) {
        if (!resolve(root).startsWith(resolve(scratchDirectory) + sep)) throw new Error("Unsafe scratch path");
        await rm(root, { recursive: true, force: true });
    }
});

async function runGate(sizeBytes, overrides = {}, env = {}, source = "") {
    await mkdir(scratchDirectory, { recursive: true });
    const root = await mkdtemp(join(scratchDirectory, "jhs-bundle-budget-"));
    scratchRoots.push(root);
    await mkdir(join(root, "scripts"));
    await mkdir(join(root, "dist", "dev"), { recursive: true });
    await mkdir(join(root, "src", "core"), { recursive: true });
    for (const file of ["scripts/release-invariants.mjs", "scripts/bundle-budget.mjs", "scripts/dev-metadata.mjs", "scripts/delivery-artifact.mjs", "src/core/theme.js"]) {
        await copyFile(new URL(`../${file}`, import.meta.url), join(root, file));
    }
    await writeFile(join(root, "package.json"), '{"type":"module"}');
    await writeFile(join(root, "JHS.user.js"), header);
    if (source) await writeFile(join(root, "src", "probe.js"), source);
    const budget = JSON.parse(await readFile(new URL("../performance-budget.json", import.meta.url), "utf8"));
    budget.bundle = { ...bundle, ...overrides };
    await writeFile(join(root, "performance-budget.json"), JSON.stringify(budget));
    if (sizeBytes !== null) {
        await writeFile(join(root, "dist", "dev", "JHS-7.0.dev.user.js"), Buffer.concat([dev, Buffer.alloc(sizeBytes - dev.length, 32)]));
    }
    const result = spawnSync(process.execPath, [join(root, "scripts", "release-invariants.mjs")], {
        cwd: root, encoding: "utf8", env: { ...process.env, GITHUB_ACTIONS: "false", ...env },
    });
    if (result.error) throw result.error;
    return { ...result, output: result.stdout + result.stderr };
}

describe("bundle budget CLI contract", () => {
    it.each([
        [1599999, "ok", 0], [1600000, "ok", 0], [1600001, "warning", 0],
        [1999999, "warning", 0], [2000000, "warning", 0], [2000001, "exceeded", 1],
    ])("classifies %i bytes as %s with exit %i", async (size, status, exitCode) => {
        const result = await runGate(size);
        expect(result.status, result.output).toBe(exitCode);
        expect(result.output).toContain(`Bundle budget ${status}`);
        expect(result.output).toContain(`${size} bytes`);
        expect(result.output).toContain("1600000");
        expect(result.output).toContain("2000000");
        expect(result.output).not.toContain("Performance budget passed");
    });

    it("emits an actionable CI warning without failing", async () => {
        const result = await runGate(1700000, {}, { GITHUB_ACTIONS: "true" });
        expect(result.status, result.output).toBe(0);
        expect(result.output).toContain("::warning::");
        expect(result.output).toContain("npm run analyze:bundle");
        expect(result.output).toContain("remaining hard 300000 bytes");
    });

    it("uses configured absolute limits independently of the historical baseline", async () => {
        const result = await runGate(1700000, { baselineBytes: 1, referenceBytes: 1 });
        expect(result.status, result.output).toBe(0);
        expect(result.output).toContain("Bundle budget warning");
    });

    it("honors reviewed threshold changes rather than hardcoded values", async () => {
        const result = await runGate(2100000, { softLimitBytes: 2000000, hardLimitBytes: 2200000 });
        expect(result.status, result.output).toBe(0);
        expect(result.output).toContain("remaining hard 100000 bytes");
    });

    it.each([
        { softLimitBytes: undefined }, { hardLimitBytes: undefined },
        { softLimitBytes: 0 }, { hardLimitBytes: -1 },
        { softLimitBytes: "1600000" }, { hardLimitBytes: 2000000.5 },
        { hardLimitBytes: Number.MAX_SAFE_INTEGER + 1 },
        { softLimitBytes: 2000000 }, { softLimitBytes: 2000001 },
        { reason: "   " }, { reason: null }, { reason: 123 },
    ])("rejects invalid budget %j", async overrides => {
        const result = await runGate(10240, overrides);
        expect(result.status, result.output).toBe(1);
        expect(result.output).toContain("Bundle budget");
    });

    it("fails if the actual Dev artifact is missing", async () => {
        const result = await runGate(null);
        expect(result.status).toBe(1);
        expect(result.output).toContain("ENOENT");
        expect(result.output).toContain("JHS-7.0.dev.user.js");
    });
});

it.each([
    ['console.log("debug")', "bypasses the shared logger"],
    ["try { action(); } catch {}", "undocumented empty catch block"],
    ["try { action(); } catch (error) {}", "undocumented empty catch block"],
    ["request.catch(() => {})", "discards a promise rejection silently"],
    ["request.catch(() => null)", "discards a promise rejection silently"],
    ["request.catch(function() { return (undefined); })", "discards a promise rejection silently"],
    ['const css = ".probe { z-index: 123 }";', "numeric z-index"],
    ['const html = `<button style="color:red">OK</button>`;', "static inline style"],
    ['const html = `<button class="button is-primary jhs-btn">OK</button>`;', "mixes JHS and Bulma"],
    ['const css = ".probe { color: var(--jhs-missing) }";', "undeclared CSS token"],
])("rejects the source violation in %s", async (source, message) => {
    const result = await runGate(10240, {}, {}, source);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain("src/probe.js");
    expect(result.output).toContain(message);
});
