import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildUserscript, repoRoot } from "./build.mjs";
import { readReleaseNotes } from "./release-notes.mjs";
import { createRcTransforms, rcFiles, rcNumber, sha256 } from "./rc-contract.mjs";

export function cleanRcSource(cwd = repoRoot) {
    const git = args => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
    if (git(["status", "--porcelain", "--untracked-files=all"])) throw new Error("RC requires a clean frozen commit; preserve and review uncommitted work first");
    return git(["rev-parse", "HEAD"]);
}
export function assertRcInputsTracked(modules, cwd = repoRoot) {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", ...modules.map(module => module.path).filter(path => !path.startsWith("node_modules/"))], { cwd, stdio: "pipe" });
}
export async function protectedHashes() {
    const paths = ["JHS.user.js", "dist/JHS.user.js", "JHS-7.0.dev.user.js", "dist/dev/JHS-7.0.dev.user.js"];
    return Promise.all(paths.map(async name => {
        try { return [name, sha256(await readFile(join(repoRoot, name)))]; }
        catch (error) { if (error.code === "ENOENT") return [name, null]; throw error; }
    }));
}
export async function buildRc(version) {
    rcNumber(version);
    const sourceSha = cleanRcSource(), before = await protectedHashes();
    await readReleaseNotes(repoRoot, version);
    const result = await buildUserscript({ outputPaths: [], ...createRcTransforms(version, sourceSha), packStaticResources: false });
    // Local excludes must not hide an imported runtime file from the frozen commit.
    assertRcInputsTracked(result.analysis.modules);
    if (cleanRcSource() !== sourceSha) throw new Error("Source changed during RC build");
    const { files, manifest } = rcFiles(result.output), folder = join(repoRoot, "dist/rc", version);
    await mkdir(folder, { recursive: true });
    for (const [name, bytes] of Object.entries(files)) {
        const path = join(folder, name);
        try { await writeFile(path, bytes, { flag: "wx" }); }
        catch (error) { if (error.code !== "EEXIST" || !(await readFile(path)).equals(Buffer.from(bytes))) throw error; }
    }
    if (JSON.stringify(before) !== JSON.stringify(await protectedHashes())) throw new Error("RC build modified another delivery artifact");
    return { folder, ...manifest };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) console.log(JSON.stringify(await buildRc(process.argv[2]), null, 2));
