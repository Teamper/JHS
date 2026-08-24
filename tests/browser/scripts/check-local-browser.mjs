import { access } from "node:fs/promises";
import path from "node:path";

if (process.env.CI) process.exit(0);

const channel = process.env.JHS_BROWSER_CHANNEL || "msedge";
if (!new Set(["msedge", "chrome"]).has(channel)) {
    throw new Error(`Unsupported JHS_BROWSER_CHANNEL=${channel}; use msedge or chrome`);
}

const roots = [process.env["PROGRAMFILES"], process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
const relativePaths = channel === "msedge"
    ? ["Microsoft/Edge/Application/msedge.exe"]
    : ["Google/Chrome/Application/chrome.exe"];
const candidates = roots.flatMap((root) => relativePaths.map((relative) => path.join(root, relative)));
let found = null;
for (const candidate of candidates) {
    try { await access(candidate); found = candidate; break; } catch { /* try the next installed location */ }
}
if (!found) {
    throw new Error(`${channel} is not installed in a standard Windows location. JHS browser tests never download a browser; install it or set JHS_BROWSER_CHANNEL to an installed channel.`);
}
console.log(`Using installed ${channel}: ${found}`);
