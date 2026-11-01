// Invoked only by the RC tag workflow, after its required checks have succeeded.
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { RC_SCRIPT, RC_META, RC_CHANNEL, assertNextRc, validateRcFiles, sha256, rcNumber, advertisedRcCommit, assertValidatedRcRun } from "./rc-contract.mjs";
import { repoRoot } from "./build.mjs";
import { readReleaseNotes } from "./release-notes.mjs";
import { uploadAndVerifyRcAsset } from "./rc-release-asset.mjs";

const version = process.argv[2], tag = `v${version}`, repository = "Teamper/JHS";
rcNumber(version);
const retryRun = process.env.JHS_RC_RETRY_RUN;
const retryBase = `refs/tags/rc-publish-retry-${version}-${retryRun}`;
const retryRef = process.env.GITHUB_REF || "";
const retry = /^[1-9]\d*$/.test(retryRun || "") && (retryRef === retryBase || (retryRef.startsWith(retryBase + "-") && /^[1-9]\d*$/.test(retryRef.slice(retryBase.length + 1))));
if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REPOSITORY !== repository || (!retry && process.env.GITHUB_REF !== `refs/tags/${tag}`)) throw new Error("Publication requires the matching Teamper/JHS RC tag workflow");
const sourceRoot = resolve(process.env.JHS_RC_SOURCE_ROOT || repoRoot);
const { verifyRcDelivery } = await import(pathToFileURL(join(sourceRoot, "scripts/check-rc-delivery.mjs")).href);
const folder = join(sourceRoot, "dist/rc", version);
const artifact = await verifyRcDelivery(join(folder, RC_SCRIPT));
if (artifact.version !== version) throw new Error("RC folder version differs from artifact");
const git = (args, cwd = sourceRoot) => execFileSync("git", args, { cwd, encoding: "utf8", timeout: 120000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "credential.helper", GIT_CONFIG_VALUE_0: "!gh auth git-credential" } }).trim();
const gh = args => execFileSync("gh", args, { cwd: sourceRoot, encoding: "utf8", timeout: 120000 });
if (retry) {
    const run = JSON.parse(gh(["api", `repos/${repository}/actions/runs/${retryRun}`]));
    const jobs = JSON.parse(gh(["api", `repos/${repository}/actions/runs/${retryRun}/jobs?per_page=100`])).jobs;
    assertValidatedRcRun(run, jobs, artifact.sourceSha);
}
// checkout may flatten annotated tags; compare peeled remote identity without replacing local tags.
git(["fetch", "--no-tags", "origin", "+refs/heads/develop:refs/remotes/origin/develop"]);
if (advertisedRcCommit(git(["ls-remote", "--tags", "origin", `refs/tags/${tag}`, `refs/tags/${tag}^{}`]), tag) !== artifact.sourceSha) throw new Error("Remote RC tag points to different source");
git(["merge-base", "--is-ancestor", artifact.sourceSha, "origin/develop"]);
if (git(["rev-list", "-n", "1", tag]) !== artifact.sourceSha) throw new Error("RC tag points to different source");
for (const line of git(["ls-remote", "--tags", "--refs", "origin", "refs/tags/v7.0.0-rc.*"]).split("\n").filter(Boolean)) {
    const ref = line.split(/\s+/)[1].replace("refs/tags/", "");
    if (ref !== tag) assertNextRc(version, ref.slice(1));
}
const names = [RC_SCRIPT, RC_META, "release-manifest.json", "SHA256SUMS"];
const notes = join(sourceRoot, "release-notes", `${version}.md`);
await readFile(notes); // Fail before publication if the reviewed notes are missing.
const releases = JSON.parse(gh(["api", `repos/${repository}/releases`, "--paginate", "--slurp"])).flat();
let release = releases.find(item => item.tag_name === tag);
const releaseNotes = !release || release.draft ? await readReleaseNotes(sourceRoot, version) : null;
if (release?.draft && release.body?.replace(/\r\n/g, "\n") !== releaseNotes) throw new Error("Draft release body differs from the reviewed version notes");
if (!release) {
    release = JSON.parse(gh(["api", "--method", "POST", `repos/${repository}/releases`,
        "-f", `tag_name=${tag}`, "-f", `target_commitish=${artifact.sourceSha}`, "-f", `name=JHS ${version}`,
        "-F", "draft=true", "-F", "prerelease=true", "-f", "make_latest=false", "-f", `body=${releaseNotes}`]));
}
if (!release.prerelease) throw new Error("Existing release is not a prerelease");
if (release.assets.some(asset => !names.includes(asset.name))) throw new Error("Unexpected release assets");
const downloaded = await mkdtemp(join(tmpdir(), "jhs-rc-assets-"));
for (const name of names) {
    const bytes = await readFile(join(folder, name));
    const verified = await uploadAndVerifyRcAsset({ release, asset: release.assets.find(asset => asset.name === name), name, bytes, token: process.env.GH_TOKEN });
    await writeFile(join(downloaded, name), verified, { flag: "wx" });
}
if (release.draft) gh(["api", "--method", "PATCH", `repos/${repository}/releases/${release.id}`, "-F", "draft=false", "-F", "prerelease=true", "-f", "make_latest=false"]);

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
