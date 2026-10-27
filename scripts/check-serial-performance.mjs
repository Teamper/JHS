import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { cpus, platform, release, totalmem } from "node:os";
import { randomUUID } from "node:crypto";
import { chromium } from "../tests/browser/node_modules/playwright-core/index.mjs";
import { repoRoot } from "./build.mjs";
import { freezeDevCandidate, verifyDevDelivery } from "./check-dev-delivery.mjs";
import { summarizePerformanceSamples, assertPerformanceReference, assertReferenceTightens } from "./performance-reference.mjs";
import { assertNoConcurrentBenchmarks } from "./benchmark-isolation.mjs";

const outputRoot = resolve(repoRoot, "output/serial-performance");
const output = resolve(outputRoot, new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomUUID().slice(0, 8)), referencePath = resolve(repoRoot, "performance-reference.json");
await mkdir(output, { recursive: true });
assertNoConcurrentBenchmarks();
const artifact = await freezeDevCandidate(resolve(process.env.JHS_TEST_BUNDLE_PATH || resolve(repoRoot, "JHS-7.0.dev.user.js")));
const channel = "msedge", browser = await chromium.launch({ channel, headless: true });
const environment = { channel, browser: browser.version(), os: platform(), release: release(), cpu: cpus()[0].model, threads: cpus().length, memory: totalmem(), node: process.versions.node };
await browser.close();
const reportPath = resolve(output, "samples.json");
const run = spawnSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "continuous-browsing-performance.spec.js", "responsive-sync-performance.spec.js", "state-operation-performance.spec.js", "--project=desktop-wide", "--workers=1", "--reporter=line,json", "--grep-invert=two foreground poll intervals"], {
    cwd: resolve(repoRoot, "tests/browser"), stdio: "inherit",
    env: { ...process.env, JHS_TEST_BUNDLE_PATH: artifact.path, JHS_SERIAL_PERFORMANCE: "1", JHS_BROWSER_CHANNEL: channel, JHS_STATE_PERF_SAMPLES: "30", JHS_PERF_ROUNDS: "30", JHS_BROWSER_OUTPUT_DIR: resolve(output, "results"), PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath },
});
if (run.status !== 0) throw new Error("串行性能场景失败，未更新参考值");
assertNoConcurrentBenchmarks();
await verifyDevDelivery(artifact.path);
const report = JSON.parse(await readFile(reportPath, "utf8")), metrics = {};
function collect(suites, parents = []) {
    for (const suite of suites) {
        const names = [...parents, suite.title];
        for (const spec of suite.specs || []) for (const test of spec.tests) {
            for (const attachment of test.results.at(-1)?.attachments || []) if (attachment.name === "performance-gate") {
                const sample = JSON.parse(Buffer.from(attachment.body, "base64").toString("utf8"));
                for (const [key, values] of Object.entries(sample)) {
                    metrics[[...names, spec.title, key].join("/")] = summarizePerformanceSamples(values);
                }
            }
        }
        collect(suite.suites || [], names);
    }
}
collect(report.suites);
if (Object.keys(metrics).length < 40) throw new Error("性能采样缺失");
const candidate = { schema: 1, environment, artifact, regressionRatio: 0.1, metrics };
await writeFile(resolve(output, "summary.json"), JSON.stringify(candidate, null, 2) + "\n");
await writeFile(resolve(outputRoot, "latest.json"), JSON.stringify({ reportPath, summaryPath: resolve(output, "summary.json"), sha256: artifact.sha256 }, null, 2) + "\n");
let reference;
try { reference = JSON.parse(await readFile(referencePath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (!reference) {
    if (!process.argv.includes("--record-reference")) throw new Error("缺少已审查参考值；采样已保存，请审查后显式 --record-reference");
    const { version, buildId, sha256, bytes } = artifact;
    await writeFile(referencePath, JSON.stringify({ ...candidate, artifact: { version, buildId, sha256, bytes } }, null, 2) + "\n", { flag: "wx" });
    console.log("已建立首次 30 次 P50/P95 参考值，后续上限为各项参考值的 110%");
} else {
    const sealed = spawnSync("git", ["show", "HEAD:performance-reference.json"], { cwd: repoRoot, encoding: "utf8" });
    if (sealed.status === 0) assertReferenceTightens(JSON.parse(sealed.stdout), reference);
    assertPerformanceReference(reference, candidate);
    console.log("串行性能 P50/P95 均通过原参考值 +10% 门槛；参考文件未修改");
}
