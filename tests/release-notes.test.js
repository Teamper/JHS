import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { chooseNotesBase, compareNotesVersions, readReleaseNotes, validateReleaseNotes } from "../scripts/release-notes.mjs";
import { checkNotes } from "../scripts/check-release-notes.mjs";
import { classifyPr, collectNotesContext, parseContextArgs, referencedNumbers } from "../scripts/release-notes-context.mjs";
import { assertLatestRevision, notesRevision, updateNotesOnly } from "../scripts/update-release-notes.mjs";

const notes = (version = "7.0.0-rc.1") => `# JHS ${version}\n\n相对 6.5.2，修复云盘匹配。\n\n## 修复\n\n- 相邻番号不再被匹配。\n`;
const directories = [];
afterEach(async () => {
    for (const path of directories.splice(0)) {
        if (dirname(resolve(path)) !== resolve(tmpdir()) || !basename(path).startsWith("jhs-notes-")) throw new Error("Unexpected fixture cleanup target");
        await rm(path, { recursive: true, force: true });
    }
});

describe("canonical release notes", () => {
    it.each(["7.0.0", "7.0.1", "7.0.0-rc.1"])("accepts %s and omitted empty categories", version => {
        expect(validateReleaseNotes(notes(version), version)).toBe(notes(version));
        expect(validateReleaseNotes(notes(version).replaceAll("\n", "\r\n"), version)).toBe(notes(version));
    });
    it.each([
        [notes("7.0.0"), /mismatch/],
        [notes() + "\n## 新增\n\n- New capability", /out-of-order/],
        [notes() + "\n## 修复\n\n- Duplicate", /duplicate/],
        [notes() + "\n## 改进\n\n", /Empty/],
        [notes() + "\n## 改进\n\n### Empty group\n", /Empty/],
        [notes() + "\n## 改进\n\n- 无。\n", /Empty/],
        [notes() + "\n## Other\n\n- Unsupported", /Unknown/],
        [notes().replace("相对 6.5.2，修复云盘匹配。", ""), /summary/],
        [notes() + "\n{{待替换}}", /placeholder/],
        [notes() + "\n{{}}", /placeholder/],
        [notes() + "\nTODO", /placeholder/],
        [notes() + "\n待填写", /placeholder/],
    ])("rejects invalid structure or template content", (body, error) => {
        expect(() => validateReleaseNotes(body, "7.0.0-rc.1")).toThrow(error);
    });
    it("ignores quoted code headings, but requires product changes", () => {
        expect(validateReleaseNotes(notes() + "\n```md\n## 新增\n# Example\n```\n", "7.0.0-rc.1")).toContain("# Example");
        expect(() => validateReleaseNotes(notes().replace("## 修复", "## 升级说明"), "7.0.0-rc.1")).toThrow(/product changes/);
    });
    it("keeps historical CHANGELOG fallback only when explicitly allowed", async () => {
        const root = await mkdtemp(join(tmpdir(), "jhs-notes-")); directories.push(root);
        await mkdir(join(root, "release-notes"));
        expect(await readReleaseNotes(root, "6.5.2", { required: false, fallback: "Old CHANGELOG notes" })).toBe("Old CHANGELOG notes");
        await expect(readReleaseNotes(root, "7.0.0", { fallback: "Do not use" })).rejects.toThrow(/ENOENT/);
        await writeFile(join(root, "release-notes", "7.0.0.md"), notes("7.0.0"));
        await writeFile(join(root, "release-notes", "TEMPLATE.md"), "{{example}}");
        expect(await readReleaseNotes(root, "7.0.0", { required: false, fallback: "legacy" })).toBe(notes("7.0.0"));
        expect(await checkNotes(root)).toEqual(["7.0.0"]);
        await writeFile(join(root, "release-notes", "7.0.0.md"), "invalid");
        await expect(readReleaseNotes(root, "7.0.0", { required: false, fallback: "legacy" })).rejects.toThrow(/mismatch/);
    });
});

describe("release comparison range and contribution evidence", () => {
    const tags = ["v6.5.1", "v6.5.2", "v7.0.0-rc.1", "v7.0.0-rc.2", "v7.0.0-rc.10", "notes-v7.0.0-rc.1-r1"];
    it.each([["7.0.0-rc.1", "v6.5.2"], ["7.0.0-rc.2", "v7.0.0-rc.1"], ["7.0.0-rc.11", "v7.0.0-rc.10"], ["7.0.0", "v6.5.2"], ["6.5.3", "v6.5.2"]])("chooses the baseline for %s", (version, base) => {
        expect(chooseNotesBase(tags, version)).toBe(base);
    });
    it("orders prereleases numerically and rejects absent baselines", () => {
        expect(compareNotesVersions("7.0.0-rc.10", "7.0.0-rc.2")).toBe(1);
        expect(compareNotesVersions("7.0.0", "7.0.0-rc.10")).toBe(1);
        expect(() => chooseNotesBase([], "7.0.0-rc.1")).toThrow(/No comparable/);
    });
    const commits = [{ sha: "port", body: "适配 PR #13 的快捷键方案\n保留 7.0 设置架构" }, { sha: "merge", body: "Merge #16" }, { sha: "fix", body: "修复 https://github.com/Teamper/JHS/issues/15" }];
    it("separates merged, manually adapted, historical and unadopted PRs", () => {
        expect(classifyPr({ number: 16, merged_at: "date", merge_commit_sha: "merge" }, commits).status).toBe("merged-in-range");
        expect(classifyPr({ number: 13, merged_at: null }, commits).status).toBe("referenced-needs-review");
        expect(classifyPr({ number: 13, merged_at: null }, commits, { 13: "port" }).status).toBe("adapted-reviewed");
        expect(classifyPr({ number: 12, merged_at: "date", merge_commit_sha: "old" }, commits).status).toBe("not-in-range");
        expect(classifyPr({ number: 3, state: "closed", merged_at: null }, commits).status).toBe("not-in-range");
        expect(() => classifyPr({ number: 13 }, commits, { 13: "old" })).toThrow(/in-range/);
        expect(() => classifyPr({ number: 13 }, commits, { 13: "fix" })).toThrow(/referencing/);
        expect(referencedNumbers(commits)).toEqual([13, 16, 15]);
    });
    it("requires an explicit target and accepts reviewed adaptation evidence", () => {
        expect(() => parseContextArgs([])).toThrow(/target/);
        expect(() => parseContextArgs(["--target", "--base"])).toThrow(/Use/);
        expect(parseContextArgs(["--target", "v7.0.0-rc.1", "--adopted-pr", "13:port"])).toMatchObject({ target: "v7.0.0-rc.1", adapted: ["13:port"] });
    });
    it("rejects a non-ancestor base before requesting any GitHub evidence", async () => {
        const root = await mkdtemp(join(tmpdir(), "jhs-notes-ancestry-")); directories.push(root);
        const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        let sequence = 0;
        const commit = () => git(["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-m", `fixture ${++sequence}`]);
        git(["init", "-q", "--initial-branch=main"]); commit();
        git(["checkout", "-b", "other"]); commit();
        git(["checkout", "main"]); commit();
        await expect(collectNotesContext({ base: "other", target: "main", version: "7.0.0", adapted: [] }, root)).rejects.toThrow(/merge-base/);
    });
});

function apiFixture({ before = {}, after = {}, fail, movedTag = false, movedLatest = false } = {}) {
    const initial = { id: 123, tag_name: "v7.0.0-rc.1", name: "JHS 7.0.0-rc.1", draft: false, prerelease: true, target_commitish: "develop", published_at: "published", html_url: "release-url", body: "old", assets: [{ id: 456, name: "script", size: 1234, digest: "sha256:abc" }], ...before };
    const calls = [];
    let patched = false;
    const api = async (method, endpoint, payload) => {
        calls.push({ method, endpoint, payload });
        if (fail === method) throw new Error("API failed");
        if (method === "PATCH") { patched = true; return {}; }
        if (endpoint.endsWith("/releases/latest")) return { id: patched && movedLatest ? 2 : 1, tag_name: "v6.5.2" };
        if (endpoint.includes("/git/ref/")) return { object: { sha: patched && movedTag ? "changed" : "frozen" } };
        return patched ? { ...initial, body: notes(), ...after } : initial;
    };
    return { api, calls };
}
describe("explicit published-body update", () => {
    it("PATCHes only body and verifies the same release, assets, tag and latest", async () => {
        const { api, calls } = apiFixture();
        await expect(updateNotesOnly({ version: "7.0.0-rc.1", body: notes(), api })).resolves.toMatchObject({ id: 123, identityUnchanged: true });
        expect(calls.filter(call => call.method !== "GET")).toEqual([{ method: "PATCH", endpoint: "repos/Teamper/JHS/releases/123", payload: { body: notes() } }]);
    });
    it.each([{ draft: true }, { tag_name: "v7.0.0-rc.2" }, { prerelease: false }])("rejects wrong or unpublished targets before mutation", async before => {
        const { api, calls } = apiFixture({ before });
        await expect(updateNotesOnly({ version: "7.0.0-rc.1", body: notes(), api })).rejects.toThrow(/target/);
        expect(calls.some(call => call.method === "PATCH")).toBe(false);
    });
    it.each([
        { after: { assets: [{ id: 999, name: "script", size: 1234, digest: "sha256:abc" }] } },
        { after: { assets: [{ id: 456, name: "script", size: 1235, digest: "sha256:abc" }] } },
        { after: { assets: [{ id: 456, name: "script", size: 1234, digest: "sha256:changed" }] } },
        { after: { name: "changed" } }, { after: { body: "truncated" } }, { movedTag: true }, { movedLatest: true },
    ])("fails verification when protected state or body differs", async changes => {
        await expect(updateNotesOnly({ version: "7.0.0-rc.1", body: notes(), api: apiFixture(changes).api })).rejects.toThrow(/unexpectedly/);
    });
    it("propagates read and patch API failures without creating releases or assets", async () => {
        for (const fail of ["GET", "PATCH"]) {
            const { api, calls } = apiFixture({ fail });
            await expect(updateNotesOnly({ version: "7.0.0-rc.1", body: notes(), api })).rejects.toThrow(/API failed/);
            expect(calls.every(call => ["GET", "PATCH"].includes(call.method))).toBe(true);
        }
    });
    it("accepts stable releases with the same body-only contract", async () => {
        const fixture = apiFixture({ before: { tag_name: "v7.0.0", prerelease: false }, after: { body: notes("7.0.0") } });
        await expect(updateNotesOnly({ version: "7.0.0", body: notes("7.0.0"), api: fixture.api })).resolves.toMatchObject({ identityUnchanged: true });
    });
    it("requires a versioned revision tag and rejects superseded revisions", () => {
        expect(notesRevision("notes-v7.0.0-rc.1-r1")).toEqual({ version: "7.0.0-rc.1", revision: 1 });
        for (const ref of ["develop", "v7.0.0-rc.1", "notes-v7.0.0-r0", "notes-v07.0.0-r1"]) expect(() => notesRevision(ref)).toThrow();
        expect(() => assertLatestRevision("7.0.0-rc.1", 1, "sha\trefs/tags/notes-v7.0.0-rc.1-r2")).toThrow(/superseded/);
        expect(() => assertLatestRevision("7.0.0-rc.1", 2, "sha\trefs/tags/notes-v7.0.0-rc.1-r1")).not.toThrow();
    });
});
