// Visual Regression Release Gate：显式开启 JHS_VISUAL_REGRESSION 后运行 Playwright，
// 与已提交的 PNG baseline 做真实 diff（toHaveScreenshot）。
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

process.env.JHS_VISUAL_REGRESSION = "1";
const browserRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const executablePath = chromium.executablePath();
if (!existsSync(executablePath)) {
  console.error(`Playwright bundled Chromium is missing: ${executablePath}`);
  console.error("Install it with: cd tests/browser && npx playwright install chromium");
  process.exit(1);
}
const result = spawnSync(npx, [ "playwright", "test", "specs/visual-regression.spec.js", "--project=desktop-wide", "--project=mobile" ], { cwd: browserRoot, stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
