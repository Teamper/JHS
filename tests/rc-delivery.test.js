import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";
import { createRcTransforms, readRcIdentity, rcFiles, validateRcFiles, assertNextRc, rcNumber, rcChecksPassed, advertisedRcCommit, assertValidatedRcRun, RC_SCRIPT, RC_META } from "../scripts/rc-contract.mjs";
import { cleanRcSource, assertRcInputsTracked } from "../scripts/build-rc.mjs";
import { buildUserscript } from "../scripts/build.mjs";
import { expectedBuildIdentity } from "./browser/harness/build-identity.js";

const sourceSha = "a".repeat(40);
const header = `// ==UserScript==\n// @name JHS\n// @namespace stable\n// @version 6.5.2\n// @description stable\n// @grant GM_getValue\n// @match https://javdb.com/*\n// @updateURL stable\n// @downloadURL stable\n// ==/UserScript==`;
function script(version = "7.0.0-rc.1") {
    const transforms = createRcTransforms(version, sourceSha);
    return transforms.transformMetadata(header) + "\n\n" + transforms.transformBundle("console.log('fixture');\n");
}
describe("RC delivery contract", () => {
    it("compares annotated and lightweight remote tags by their source commit", () => {
        const tag = "v7.0.0-rc.1", object = "b".repeat(40);
        expect(advertisedRcCommit(`${object}\trefs/tags/${tag}\n${sourceSha}\trefs/tags/${tag}^{}\n`, tag)).toBe(sourceSha);
        expect(advertisedRcCommit(`${sourceSha}\trefs/tags/${tag}\n`, tag)).toBe(sourceSha);
        expect(() => advertisedRcCommit("", tag)).toThrow();
    });
    it("requires successful prior candidate and compatibility jobs for the exact RC source", () => {
        const run = { repository: { full_name: "Teamper/JHS" }, head_sha: sourceSha, path: ".github/workflows/release-rc.yml", event: "push", status: "completed" };
        const jobs = [{ name: "node20", conclusion: "success" }, { name: "candidate", conclusion: "success" }, { name: "publish", conclusion: "failure" }];
        expect(() => assertValidatedRcRun(run, jobs, sourceSha)).not.toThrow();
        for (const bad of [{ ...run, head_sha: "b".repeat(40) }, { ...run, status: "in_progress" }, { ...run, path: "other.yml" }, { ...run, repository: { full_name: "other/JHS" } }]) expect(() => assertValidatedRcRun(bad, jobs, sourceSha)).toThrow();
        expect(() => assertValidatedRcRun(run, jobs.filter(job => job.name !== "candidate"), sourceSha)).toThrow();
        expect(() => assertValidatedRcRun(run, jobs.map(job => ({ ...job, conclusion: "failure" })), sourceSha)).toThrow();
    });
    it("reports serial performance failures without bypassing required checks", () => {
        const required = ["check", "functional", "visual"].map(name => ({ name, status: 0 }));
        expect(rcChecksPassed([...required, { name: "serial", status: 1 }, { name: "startup", status: 1 }])).toBe(true);
        for (const name of ["check", "functional", "visual"]) {
            expect(rcChecksPassed(required.filter(result => result.name !== name))).toBe(false);
            expect(rcChecksPassed(required.map(result => result.name === name ? { ...result, status: 1 } : result))).toBe(false);
        }
    });
    it.each(["7.0.0", "7.0.0-dev.123", "7.1.0-rc.1", "7.0.0-rc.0", "7.0.0-rc.01", "7.0.0-rc.9007199254740992"])("rejects invalid version %s", version => expect(() => rcNumber(version)).toThrow());
    it("orders RC numbers numerically and refuses reuse/downgrade", () => {
        assertNextRc("7.0.0-rc.10", "7.0.0-rc.2");
        expect(() => assertNextRc("7.0.0-rc.2", "7.0.0-rc.10")).toThrow();
        expect(() => assertNextRc("7.0.0-rc.1", "7.0.0-rc.1")).toThrow();
        expect(() => createRcTransforms("7.0.0-rc.1", sourceSha + ".dirty")).toThrow();
    });
    it("keeps grants and matches, fixes channel, normalizes metadata", () => {
        const transform = createRcTransforms("7.0.0-rc.1", sourceSha);
        expect(transform.transformMetadata(header.replaceAll("\n", "\r\n"))).toBe(transform.transformMetadata(header));
        const source = script();
        expect(source).toContain("// @grant GM_getValue\n// @match https://javdb.com/*");
        expect(readRcIdentity(source)).toMatchObject({ version: "7.0.0-rc.1", sourceSha });
        for (const changed of [source.replace("rc-channel", "develop"), source.replace("data-jhs-rc-build", "data-jhs-dev-build"), source.replace("// @name", "// @name JHS\n// @name")]) expect(() => readRcIdentity(changed)).toThrow();
    });
    it("binds metadata, script, checksums and manifest to exact bytes", () => {
        const { files } = rcFiles(script());
        expect(validateRcFiles(files).sourceSha).toBe(sourceSha);
        expect(files[RC_META]).not.toContain("console.log");
        for (const name of Object.keys(files)) expect(() => validateRcFiles({ ...files, [name]: files[name] + " " })).toThrow();
        expect(validateRcFiles(Object.fromEntries(Object.entries(files).map(([key, value]) => [key, Buffer.from(value)]))).version).toBe("7.0.0-rc.1");
    });
    it("requires a clean commit including untracked files", async () => {
        const folder = await mkdtemp(join(tmpdir(), "jhs-rc-test-"));
        try {
            const git = args => execFileSync("git", args, { cwd: folder, encoding: "utf8" }).trim();
            git(["init", "-q", "--initial-branch=main"]);
            await writeFile(join(folder, "source.txt"), "frozen");
            git(["add", "source.txt"]);
            git(["-c", "user.name=test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture"]);
            expect(cleanRcSource(folder)).toBe(git(["rev-parse", "HEAD"]));
            assertRcInputsTracked([{ path: "source.txt" }], folder);
            await writeFile(join(folder, ".git/info/exclude"), "hidden.js\n");
            await writeFile(join(folder, "hidden.js"), "ignored runtime input");
            expect(cleanRcSource(folder)).toBe(git(["rev-parse", "HEAD"]));
            expect(() => assertRcInputsTracked([{ path: "hidden.js" }], folder)).toThrow();
            await writeFile(join(folder, "untracked.txt"), "draft");
            expect(() => cleanRcSource(folder)).toThrow(/clean frozen/);
            await rm(join(folder, "untracked.txt"));
            await writeFile(join(folder, "source.txt"), "edited");
            expect(() => cleanRcSource(folder)).toThrow(/clean frozen/);
        } finally {
            if (dirname(resolve(folder)) !== resolve(tmpdir()) || !basename(folder).startsWith("jhs-rc-test-")) throw new Error("Unexpected test cleanup target");
            await rm(folder, { recursive: true, force: true });
        }
    });
    it("builds actual source reproducibly in memory without touching deliveries", async () => {
        const before = await readFile(new URL("../JHS.user.js", import.meta.url));
        const options = { outputPaths: [], ...createRcTransforms("7.0.0-rc.1", sourceSha), packStaticResources: false };
        const first = await buildUserscript(options), second = await buildUserscript(options);
        expect(first.output).toBe(second.output);
        expect(validateRcFiles(rcFiles(first.output).files).files[RC_SCRIPT].sha256).toBe(first.analysis.sha256);
        expect(await readFile(new URL("../JHS.user.js", import.meta.url))).toEqual(before);
    }, 30000);
    it("preserves strict Dev assertions by default and selects RC explicitly", () => {
        const previous = process.env.JHS_TEST_CHANNEL;
        try {
            delete process.env.JHS_TEST_CHANNEL;
            expect(expectedBuildIdentity().attribute).toBe("data-jhs-dev-build");
            process.env.JHS_TEST_CHANNEL = "rc";
            expect(expectedBuildIdentity().pattern.test(`7.0.0-rc.10|${sourceSha}`)).toBe(true);
            expect(expectedBuildIdentity().pattern.test("7.0.0-dev.202611010000|aaaaaaaaaaaa.dirty")).toBe(false);
        } finally {
            if (previous === undefined) delete process.env.JHS_TEST_CHANNEL;
            else process.env.JHS_TEST_CHANNEL = previous;
        }
    });
});
