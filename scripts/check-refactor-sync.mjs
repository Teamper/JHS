import { execFileSync } from "node:child_process";

const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "";

if (branch !== "refactor/6.5") {
  console.log("6.5 ancestry check skipped outside refactor/6.5");
  process.exit(0);
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

try {
  execFileSync("git", ["merge-base", "--is-ancestor", "origin/main", "HEAD"], { stdio: "ignore" });
  console.log("refactor/6.5 contains current origin/main");
} catch {
  const mainTimestamp = Number(git(["show", "-s", "--format=%ct", "origin/main"]));
  const ageHours = (Date.now() / 1000 - mainTimestamp) / 3600;
  const message = `refactor/6.5 does not contain origin/main; latest main commit is ${ageHours.toFixed(1)} hours old`;
  if (ageHours > 24) throw new Error(`${message}, exceeding the 24-hour hotfix sync policy`);
  console.warn(`::warning::${message}; sync it before the 24-hour deadline`);
}
