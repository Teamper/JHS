import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildRc } from "./build-rc.mjs";
import { freezeRcCandidate, verifyRcDelivery } from "./check-rc-delivery.mjs";
import { repoRoot } from "./build.mjs";
import { RC_SCRIPT, rcChecksPassed } from "./rc-contract.mjs";

const version = process.argv[2];
const built = await buildRc(version);
const artifact = await freezeRcCandidate(join(built.folder, RC_SCRIPT));
const env = { ...process.env, JHS_TEST_BUNDLE_PATH: artifact.path, JHS_TEST_CHANNEL: "rc" };
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const checks = [
    ["check", ["run", "check"]],
    ["startup", ["--prefix", "tests/browser", "run", "test:startup"]],
    ["functional", ["--prefix", "tests/browser", "run", "test:functional"]],
    ["serial", ["run", "check:performance:serial"]],
    ["visual", ["run", "check:visual"]],
];
const results = [];
for (const [name, args] of checks) {
    const run = spawnSync(npm, args, { cwd: repoRoot, env: {
        ...env,
        JHS_BROWSER_OUTPUT_DIR: join(repoRoot, "output/rc-validation", version, name, "test-results"),
        JHS_BROWSER_REPORT_DIR: join(repoRoot, "output/rc-validation", version, name, "report"),
    }, stdio: "inherit", shell: process.platform === "win32" });
    results.push({ name, status: run.status, error: run.error?.message, blocking: !["startup", "serial"].includes(name) });
}
await verifyRcDelivery(artifact.path);
const report = { artifact, results, passed: rcChecksPassed(results) };
await mkdir(join(repoRoot, "output/rc-validation"), { recursive: true });
await writeFile(join(repoRoot, "output/rc-validation", `${version}.json`), JSON.stringify(report, null, 2) + "\n");
if (!report.passed) throw new Error("RC validation failed; see output/rc-validation");
