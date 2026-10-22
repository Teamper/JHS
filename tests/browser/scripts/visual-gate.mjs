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
const result = spawnSync(npx, [ "playwright", "test", "specs/visual-regression.spec.js", "specs/ui-evolution.spec.js", "specs/ui-root-fix.spec.js", "--project=desktop-wide", "--project=mobile", "--update-snapshots=none" ], { cwd: browserRoot, stdio: "inherit", shell: process.platform === "win32" });
if (result.status !== 0) process.exit(result.status ?? 1);
const shortcutResult = spawnSync(npx, [ "playwright", "test", "specs/detail-shortcuts.spec.js", "--grep=鉴定快捷键布局", "--project=desktop-wide", "--project=mobile", "--update-snapshots=none" ], { cwd: browserRoot, stdio: "inherit", shell: process.platform === "win32" });
if (shortcutResult.status !== 0) process.exit(shortcutResult.status ?? 1);
const autoBackupResult = spawnSync(npx, [ "playwright", "test", "specs/webdav-auto-backup.spec.js", "--grep=多端同步布局", "--project=desktop-wide", "--project=mobile", "--update-snapshots=none" ], { cwd: browserRoot, stdio: "inherit", shell: process.platform === "win32" });
if (autoBackupResult.status !== 0) process.exit(autoBackupResult.status ?? 1);
const detailResult = spawnSync(npx, [ "playwright", "test", "specs/detail-settings-regressions.spec.js", "--update-snapshots=none" ], { cwd: browserRoot, stdio: "inherit", shell: process.platform === "win32" });
if (detailResult.status !== 0) process.exit(detailResult.status ?? 1);
const menuResult = spawnSync(npx, [ "playwright", "test", "specs/menu-reuse.spec.js", "--update-snapshots=none" ], { cwd: browserRoot, stdio: "inherit", shell: process.platform === "win32" });
if (menuResult.status !== 0) process.exit(menuResult.status ?? 1);
const nativeTileResult = spawnSync(npx, [ "playwright", "test", "specs/native-recommendation-tiles.spec.js", "--update-snapshots=none" ], { cwd: browserRoot, stdio: "inherit", shell: process.platform === "win32" });
if (nativeTileResult.status !== 0) process.exit(nativeTileResult.status ?? 1);
const viewerResult = spawnSync(npx, [ "playwright", "test", "specs/unified-image-viewer.spec.js", "--grep=unified long-image controls", "--update-snapshots=none" ], { cwd: browserRoot, stdio: "inherit", shell: process.platform === "win32" });
if (viewerResult.status !== 0) process.exit(viewerResult.status ?? 1);
const isolatedSheetResult = spawnSync(npx, [ "playwright", "test", "specs/image-kind-isolation.spec.js", "--grep=late sheet stays outside photographs", "--update-snapshots=none" ], { cwd: browserRoot, stdio: "inherit", shell: process.platform === "win32" });
process.exit(isolatedSheetResult.status ?? 1);
