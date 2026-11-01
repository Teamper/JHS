import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseNotesVersion, readReleaseNotes, validateReleaseNotes } from "./release-notes.mjs";

export function notesRevision(ref) {
    const match = /^notes-v(.+)-r([1-9]\d*)$/.exec(ref || "");
    if (!match || !Number.isSafeInteger(Number(match[2]))) throw new Error("Expected notes-v<version>-r<N> tag");
    parseNotesVersion(match[1]);
    return { version: match[1], revision: Number(match[2]) };
}
export function assertLatestRevision(version, revision, remoteTags) {
    for (const line of remoteTags.split(/\r?\n/).filter(Boolean)) {
        const ref = line.split(/\s+/)[1]?.replace("refs/tags/", "");
        const other = notesRevision(ref);
        if (other.version === version && other.revision > revision) throw new Error("Notes revision has been superseded");
    }
}
export function releaseIdentity(release) {
    return { id: release.id, tag: release.tag_name, name: release.name, target: release.target_commitish,
        draft: release.draft, prerelease: release.prerelease, published: release.published_at,
        assets: release.assets.map(a => ({ id: a.id, name: a.name, size: a.size, digest: a.digest })).sort((a, b) => a.id - b.id) };
}
export async function updateNotesOnly({ version, body, api }) {
    body = validateReleaseNotes(body, version);
    const repo = "repos/Teamper/JHS", tag = `v${version}`;
    const before = await api("GET", `${repo}/releases/tags/${tag}`);
    if (before.tag_name !== tag || before.draft || !Number.isSafeInteger(before.id) || before.prerelease !== !!parseNotesVersion(version).pre.length) throw new Error("Wrong published release target");
    const tagBefore = await api("GET", `${repo}/git/ref/tags/${tag}`);
    const latest = await api("GET", `${repo}/releases/latest`);
    await api("PATCH", `${repo}/releases/${before.id}`, { body });
    const after = await api("GET", `${repo}/releases/${before.id}`);
    const tagAfter = await api("GET", `${repo}/git/ref/tags/${tag}`);
    const latestAfter = await api("GET", `${repo}/releases/latest`);
    if (after.body !== body || JSON.stringify(releaseIdentity(before)) !== JSON.stringify(releaseIdentity(after)) || tagBefore.object.sha !== tagAfter.object.sha || latest.id !== latestAfter.id || latest.tag_name !== latestAfter.tag_name) throw new Error("Release body, identity, assets, tag or latest changed unexpectedly");
    return { version, release: after.html_url, id: after.id, identityUnchanged: true };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { version, revision } = notesRevision(process.env.GITHUB_REF_NAME);
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REPOSITORY !== "Teamper/JHS" || process.env.GITHUB_EVENT_NAME !== "push" || process.env.GITHUB_REF !== `refs/tags/${process.env.GITHUB_REF_NAME}`) throw new Error("Notes updates require the explicit Teamper/JHS revision tag workflow");
    const root = fileURLToPath(new URL("..", import.meta.url));
    assertLatestRevision(version, revision, execFileSync("git", ["ls-remote", "--tags", "--refs", "origin", `refs/tags/notes-v${version}-r*`], { cwd: root, encoding: "utf8", timeout: 60000 }));
    const body = await readReleaseNotes(root, version);
    const api = async (method, endpoint, payload) => JSON.parse(execFileSync("gh", ["api", "--method", method, endpoint, ...(payload ? ["--input", "-"] : [])], {
        encoding: "utf8", input: payload ? JSON.stringify(payload) : undefined, timeout: 60000,
    }));
    console.log(JSON.stringify(await updateNotesOnly({ version, body, api }), null, 2));
}
