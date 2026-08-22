import { appendFile, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function parseStableVersion(version, label = "version") {
  const match = String(version ?? "").match(STABLE_VERSION_PATTERN);
  assert(match, `${label} must use stable X.Y.Z format`);
  return match.slice(1).map(Number);
}

export function compareStableVersions(left, right) {
  const leftParts = parseStableVersion(left, "current version");
  const rightParts = parseStableVersion(right, "previous version");
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
}

export function extractUserscriptVersion(source, label) {
  const matches = [...source.matchAll(/^\/\/ @version\s+(\S+)\s*$/gm)];
  assert(matches.length === 1, `${label} must contain exactly one @version`);
  return matches[0][1];
}

export function extractReleaseNotes(changelog, version) {
  const headingPattern = /^## \[([^\]]+)\](?:\([^\r\n]+\))?(?:\s+-\s+[^\r\n]+)?\s*$/gm;
  const headings = [...changelog.matchAll(headingPattern)];
  const matchingHeadings = headings.filter((heading) => heading[1] === version);
  assert(matchingHeadings.length === 1, `CHANGELOG.md must contain exactly one section for ${version}`);

  const heading = matchingHeadings[0];
  const nextHeading = headings.find((candidate) => candidate.index > heading.index);
  const notes = changelog.slice(heading.index + heading[0].length, nextHeading?.index ?? changelog.length).trim();
  assert(notes.length > 0, `CHANGELOG.md section for ${version} must not be empty`);
  return notes;
}

export function validateReleaseContract({ packageSource, lockSource, mainSource, outputSource, changelogSource }) {
  const packageJson = JSON.parse(packageSource);
  const packageLock = JSON.parse(lockSource);
  const version = packageJson.version;
  parseStableVersion(version, "package.json version");

  const versions = [
    ["package-lock.json version", packageLock.version],
    ["package-lock.json root package version", packageLock.packages?.[""]?.version],
    ["src/main.js @version", extractUserscriptVersion(mainSource, "src/main.js")],
    ["JHS.user.js @version", extractUserscriptVersion(outputSource, "JHS.user.js")]
  ];
  for (const [label, candidate] of versions) {
    assert(candidate === version, `${label} does not match package.json version ${version}`);
  }

  return { version, notes: extractReleaseNotes(changelogSource, version) };
}

export function decideRelease(version, { previousVersion, forceRelease = false } = {}) {
  parseStableVersion(version, "current version");
  if (forceRelease) {
    return true;
  }
  assert(previousVersion, "previous version is required unless --force-release is used");
  const comparison = compareStableVersions(version, previousVersion);
  if (comparison === 0) {
    return false;
  }
  assert(comparison > 0, `version must increase: ${previousVersion} -> ${version}`);
  return true;
}

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--force-release") {
      options.forceRelease = true;
      continue;
    }
    if (["--base-ref", "--github-output", "--notes-file"].includes(argument)) {
      const value = args[index + 1];
      assert(value && !value.startsWith("--"), `${argument} requires a value`);
      options[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  assert(!(options.baseRef && options.forceRelease), "--base-ref and --force-release cannot be combined");
  return options;
}

async function readContract(root) {
  const [packageSource, lockSource, mainSource, outputSource, changelogSource] = await Promise.all([
    readFile(join(root, "package.json"), "utf8"),
    readFile(join(root, "package-lock.json"), "utf8"),
    readFile(join(root, "src", "main.js"), "utf8"),
    readFile(join(root, "JHS.user.js"), "utf8"),
    readFile(join(root, "CHANGELOG.md"), "utf8")
  ]);
  return validateReleaseContract({ packageSource, lockSource, mainSource, outputSource, changelogSource });
}

function readVersionAtRef(baseRef) {
  const packageSource = execFileSync("git", ["show", `${baseRef}:package.json`], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return JSON.parse(packageSource).version;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const contract = await readContract(repoRoot);
  let shouldRelease = false;

  if (options.baseRef || options.forceRelease) {
    const previousVersion = options.baseRef ? readVersionAtRef(options.baseRef) : undefined;
    shouldRelease = decideRelease(contract.version, { previousVersion, forceRelease: options.forceRelease });
  }
  if (options.notesFile && shouldRelease) {
    await writeFile(resolve(options.notesFile), `${contract.notes}\n`, "utf8");
  }

  const outputs = `version=${contract.version}\ntag=v${contract.version}\nshould_release=${shouldRelease}\n`;
  if (options.githubOutput) {
    await appendFile(resolve(options.githubOutput), outputs, "utf8");
  }
  console.log(`Release contract passed for ${contract.version}; should_release=${shouldRelease}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
