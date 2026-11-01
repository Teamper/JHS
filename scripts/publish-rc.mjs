// Invoked only by the RC tag workflow, after its required checks have succeeded.
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyRcDelivery } from "./check-rc-delivery.mjs";
import { RC_SCRIPT, RC_META, RC_CHANNEL, assertNextRc, validateRcFiles, sha256 } from "./rc-contract.mjs";
import { repoRoot } from "./build.mjs";

const version = process.argv[2], tag = `v${version}`, repository = "Teamper/JHS";
if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REPOSITORY !== repository || process.env.GITHUB_REF !== `refs/tags/${tag}`) throw new Error("Publication requires the matching Teamper/JHS RC tag workflow");
const folder = join(repoRoot, "dist/rc", version);
const artifact = await verifyRcDelivery(join(folder, RC_SCRIPT));
if (artifact.version !== version) throw new Error("RC folder version differs from artifact");
const git = (args, cwd = repoRoot) => execFileSync("git", args, { cwd, encoding: "utf8", timeout: 120000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "credential.helper", GIT_CONFIG_VALUE_0: "!gh auth git-credential" } }).trim();
const gh = args => execFileSync("gh", args, { cwd: repoRoot, encoding: "utf8", timeout: 120000 });
git(["fetch", "origin", "develop", "--tags"]);
git(["merge-base", "--is-ancestor", artifact.sourceSha, "origin/develop"]);
if (git(["rev-list", "-n", "1", tag]) !== artifact.sourceSha) throw new Error("RC tag points to different source");
for (const ref of git(["tag", "--list", "v7.0.0-rc.*"]).split("\n").filter(ref => ref && ref !== tag)) assertNextRc(version, ref.slice(1));
const names = [RC_SCRIPT, RC_META, "release-manifest.json", "SHA256SUMS"];
const notes = join(repoRoot, "release-notes", `${version}.md`);
await readFile(notes); // Fail before publication if the reviewed notes are missing.
const releases = JSON.parse(gh(["api", `repos/${repository}/releases`, "--paginate", "--slurp"])).flat();
let release = releases.find(item => item.tag_name === tag);
if (!release) {
    gh(["release", "create", tag, "--repo", repository, "--verify-tag", "--draft", "--prerelease", "--latest=false", "--title", `JHS ${version}`, "--notes-file", notes]);
    release = JSON.parse(gh(["api", `repos/${repository}/releases/tags/${tag}`]));
}
if (!release.prerelease) throw new Error("Existing release is not a prerelease");
if (release.assets.some(asset => !names.includes(asset.name))) throw new Error("Unexpected release assets");
const downloaded = await mkdtemp(join(tmpdir(), "jhs-rc-assets-"));
for (const name of names) {
    const existing = release.assets.find(asset => asset.name === name);
    if (!existing) {
        if (!release.draft) throw new Error("Published RC has missing assets; refusing to mutate it");
        gh(["release", "upload", tag, join(folder, name), "--repo", repository]);
    }
    gh(["release", "download", tag, "--repo", repository, "--pattern", name, "--dir", downloaded]);
    if (!(await readFile(join(downloaded, name))).equals(await readFile(join(folder, name)))) throw new Error(`Existing RC asset differs: ${name}`);
}
if (release.draft) gh(["release", "edit", tag, "--repo", repository, "--draft=false", "--prerelease", "--latest=false"]);

// The distribution branch is not a source branch. Both update files move in one commit.
const channel = await mkdtemp(join(tmpdir(), "jhs-rc-channel-"));
git(["init", channel]);
git(["remote", "add", "origin", "https://github.com/Teamper/JHS.git"], channel);
let current;
const remote = git(["ls-remote", "--heads", "origin", "rc-channel"], channel);
if (remote) {
    git(["fetch", "origin", "rc-channel"], channel);
    git(["checkout", "-b", "rc-channel", "FETCH_HEAD"], channel);
    current = JSON.parse(await readFile(join(channel, "release-manifest.json"), "utf8"));
    if (current.version !== version) assertNextRc(version, current.version);
    else if (current.sourceSha !== artifact.sourceSha) throw new Error("RC channel source mismatch");
} else git(["checkout", "--orphan", "rc-channel"], channel);
for (const name of names) {
    const bytes = await readFile(join(downloaded, name));
    if (remote) {
        if (current.version === version && !(await readFile(join(channel, name))).equals(bytes)) throw new Error("Refusing to overwrite same-version RC channel");
    }
    await writeFile(join(channel, name), bytes);
}
git(["add", "--", ...names], channel);
if (git(["status", "--porcelain"], channel)) {
    git(["-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com", "commit", "-m", `Release: 发布 JHS ${version} 更新通道`], channel);
    git(["push", "origin", "HEAD:refs/heads/rc-channel"], channel); // No force; a concurrent change fails safely.
}
const publicFiles = {};
for (const name of names) {
    const response = await fetch(RC_CHANNEL + name, { cache: "no-store", signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`RC public endpoint HTTP ${response.status}: ${name}; retry the unchanged workflow after cache propagation`);
    publicFiles[name] = Buffer.from(await response.arrayBuffer());
    if (sha256(publicFiles[name]) !== sha256(await readFile(join(downloaded, name)))) throw new Error(`RC public endpoint not yet consistent: ${name}; retry unchanged workflow`);
}
validateRcFiles(publicFiles);
console.log(JSON.stringify({ tag, ...artifact, channelVerified: true }, null, 2));
