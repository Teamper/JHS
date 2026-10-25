import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const scratchRoots = [];
const bundle = {
    baselineBytes: 1170844, referenceBytes: 1170844, referenceCommit: "4ea5536",
    softLimitBytes: 1600000, hardLimitBytes: 2000000,
    reason: "7.0 uses absolute project budgets; 6.5 is historical context only",
};

afterEach(async () => {
    for (const root of scratchRoots.splice(0)) {
        if (!resolve(root).startsWith(resolve(tmpdir()) + sep)) throw new Error("Unsafe scratch path");
        await rm(root, { recursive: true, force: true });
    }
});

async function runGate(sizeBytes, overrides = {}, env = {}) {
    const root = await mkdtemp(join(tmpdir(), "jhs-bundle-budget-"));
    scratchRoots.push(root);
    await mkdir(join(root, "scripts"));
    await mkdir(join(root, "dist", "dev"), { recursive: true });
    const scriptDirectory = new URL("../scripts/", import.meta.url);
    for (const name of await readdir(scriptDirectory)) {
        if (name === "performance-budget-check.mjs" || name === "bundle-budget.mjs") {
            await copyFile(new URL(name, scriptDirectory), join(root, "scripts", name));
        }
    }
    const budget = JSON.parse(await readFile(new URL("../performance-budget.json", import.meta.url), "utf8"));
    budget.bundle = { ...bundle, ...overrides };
    await writeFile(join(root, "performance-budget.json"), JSON.stringify(budget));
    if (sizeBytes !== null) await writeFile(join(root, "dist", "dev", "JHS-7.0.dev.user.js"), Buffer.alloc(sizeBytes, 32));
    const result = spawnSync(process.execPath, [join(root, "scripts", "performance-budget-check.mjs")], {
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
        const result = await runGate(100, overrides);
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
