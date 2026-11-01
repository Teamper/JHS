import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chooseNotesBase, parseNotesVersion } from "./release-notes.mjs";

export function classifyPr(pr, commits, adapted = {}) {
    const ids = new Set(commits.map(commit => commit.sha));
    const mentions = commits.filter(commit => new RegExp(`(?:#${pr.number}\\b|/pull/${pr.number}\\b)`).test(commit.body)).map(commit => commit.sha);
    if (pr.merged_at && ids.has(pr.merge_commit_sha)) return { status: "merged-in-range", evidence: [pr.merge_commit_sha] };
    if (adapted[pr.number]) {
        if (!ids.has(adapted[pr.number]) || !mentions.includes(adapted[pr.number])) throw new Error(`Adapted PR #${pr.number} requires an in-range commit referencing it`);
        return { status: "adapted-reviewed", evidence: [adapted[pr.number]] };
    }
    return { status: mentions.length ? "referenced-needs-review" : "not-in-range", evidence: mentions };
}
export function referencedNumbers(commits) {
    return [...new Set(commits.flatMap(commit => [...commit.body.matchAll(/#(\d+)\b|github\.com\/Teamper\/JHS\/(?:pull|issues)\/(\d+)\b/g)].map(match => Number(match[1] || match[2]))))];
}
export function parseContextArgs(args) {
    const options = { adapted: [] };
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i], value = args[i + 1];
        if (!["--target", "--base", "--version", "--adopted-pr"].includes(key) || !value || value.startsWith("--")) throw new Error("Use --target <ref> [--base <tag>] [--version <version>] [--adopted-pr <number>:<commit>]");
        if (key === "--adopted-pr") options.adapted.push(value);
        else options[key.slice(2)] = value;
    }
    if (!options.target) throw new Error("Explicit --target is required");
    return options;
}
export async function collectNotesContext(options, root = fileURLToPath(new URL("..", import.meta.url))) {
    const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trimEnd();
    const commitAt = ref => git(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]);
    const targetSha = commitAt(options.target);
    const version = options.version || options.target.replace(/^v/, "");
    if (!options.base) parseNotesVersion(version);
    const base = options.base || chooseNotesBase(git(["tag", "--merged", targetSha]).split("\n"), version);
    const baseSha = commitAt(base);
    git(["merge-base", "--is-ancestor", baseSha, targetSha]);
    const range = `${baseSha}..${targetSha}`;
    const commits = git(["log", "--reverse", "--format=%H", range]).split("\n").filter(Boolean).map(sha => {
        const [author, email, body] = git(["show", "-s", "--format=%an%x00%ae%x00%B", sha]).split("\0");
        return { sha, author, email, body };
    });
    const adapted = {};
    for (const declaration of options.adapted || []) {
        const match = /^([1-9]\d*):(.+)$/.exec(declaration);
        if (!match) throw new Error("Adapted PR declaration must be <number>:<evidence commit>");
        adapted[match[1]] = commitAt(match[2]);
    }
    const api = endpoint => JSON.parse(execFileSync("gh", ["api", endpoint, "--paginate", "--slurp"], { cwd: root, encoding: "utf8", timeout: 120000 }));
    const allPrs = api("repos/Teamper/JHS/pulls?state=all&per_page=100").flat();
    for (const number of Object.keys(adapted)) if (!allPrs.some(pr => pr.number === Number(number))) throw new Error(`Unknown adapted PR #${number}`);
    const prs = allPrs.map(pr => ({ number: pr.number, author: pr.user.login, title: pr.title, url: pr.html_url, body: pr.body,
        ...classifyPr(pr, commits, adapted) }));
    const relatedPrs = prs.filter(pr => pr.status !== "not-in-range");
    const issues = referencedNumbers(commits).filter(number => !allPrs.some(pr => pr.number === number)).map(number => {
        const issue = api(`repos/Teamper/JHS/issues/${number}`)[0];
        return { number, author: issue.user.login, title: issue.title, body: issue.body, url: issue.html_url,
            status: "referenced-needs-fix-scope-review", evidence: commits.filter(commit => new RegExp(`#${number}\\b|/issues/${number}\\b`).test(commit.body)).map(commit => commit.sha) };
    });
    const authors = [...new Set(commits.map(commit => commit.author))].map(author => ({ author, email: commits.find(commit => commit.author === author).email, commits: commits.filter(commit => commit.author === author).map(commit => commit.sha) }));
    const report = { repository: "Teamper/JHS", base, baseSha, target: options.target, targetSha, version,
        commits, authors, diffStat: git(["diff", "--stat", baseSha, targetSha]), files: git(["diff", "--name-status", "-M", baseSha, targetSha]).split("\n"),
        pullRequests: relatedPrs, excludedPullRequests: prs.filter(pr => pr.status === "not-in-range").map(({ number, author, status }) => ({ number, author, status })), issues,
        thanksCandidates: relatedPrs.filter(pr => ["merged-in-range", "adapted-reviewed"].includes(pr.status) && pr.author !== "Teamper").map(pr => ({ author: pr.author, kind: "code", reference: pr.url, evidence: pr.evidence })),
        directAuthorCandidates: authors.filter(item => item.author !== "Teamper" && !/\+Teamper@users\.noreply\.github\.com$/i.test(item.email)),
        feedbackCandidates: issues.filter(issue => issue.author !== "Teamper").map(issue => ({ author: issue.author, kind: "feedback", reference: issue.url, status: issue.status, evidence: issue.evidence })),
        reviewRequired: "Verify behavior against target code; review referenced issue fix scope and unconfirmed PRs. Do not infer adoption from dates or closed status. Maintainer authors are retained above for audit, not self-thanks." };
    const directory = resolve(root, "output/release-notes-context");
    await mkdir(directory, { recursive: true });
    const path = resolve(directory, `${baseSha.slice(0, 12)}-${targetSha.slice(0, 12)}.json`);
    await writeFile(path, JSON.stringify(report, null, 2) + "\n");
    return { path, report };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { path, report } = await collectNotesContext(parseContextArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ path, base: report.base, targetSha: report.targetSha, commits: report.commits.length, prs: report.pullRequests.map(pr => ({ number: pr.number, status: pr.status })), issues: report.issues.map(issue => issue.number) }, null, 2));
}
