import { execFileSync } from "node:child_process";

const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "";

if (!branch.startsWith("refactor/")) {
  console.log("Refactor ancestry check skipped outside refactor/*");
  process.exit(0);
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

try {
  execFileSync("git", ["merge-base", "--is-ancestor", "origin/main", "HEAD"], { stdio: "ignore" });
  console.log(`${branch} contains current origin/main`);
} catch {
  const mainTimestamp = Number(git(["show", "-s", "--format=%ct", "origin/main"]));
  const ageHours = (Date.now() / 1000 - mainTimestamp) / 3600;
  const message = `${branch} does not contain origin/main; latest main commit is ${ageHours.toFixed(1)} hours old`;
  if (ageHours > 24) throw new Error(`${message}, exceeding the 24-hour hotfix sync policy`);
  console.warn(`::warning::${message}; sync it before the 24-hour deadline`);
}
