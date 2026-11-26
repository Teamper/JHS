// Visual Regression Release Gate：显式开启 JHS_VISUAL_REGRESSION 后运行 Playwright，
// 与已提交的 PNG baseline 做真实 diff（toHaveScreenshot）。
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

process.env.JHS_VISUAL_REGRESSION = "1";
const browserRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const playwright = fileURLToPath(import.meta.resolve("@playwright/test/cli"));
const executablePath = chromium.executablePath();
if (!existsSync(executablePath)) {
  console.error(`Playwright bundled Chromium is missing: ${executablePath}`);
  console.error("Install it with: cd tests/browser && npx playwright install chromium");
  process.exit(1);
}
const runs = [
  ["specs/visual-regression.spec.js", "specs/home-list-boundary.spec.js", "specs/ui-evolution.spec.js", "specs/ui-root-fix.spec.js", "specs/detail-settings-regressions.spec.js", "specs/native-recommendation-tiles.spec.js"],
  ["specs/detail-shortcuts.spec.js", "--grep=鉴定快捷键布局"],
  ["specs/webdav-auto-backup.spec.js", "--grep=多端同步布局"],
  ["specs/menu-reuse.spec.js", "--project=desktop-regular"],
  ["specs/unified-image-viewer.spec.js", "--grep=unified long-image controls"],
  ["specs/image-kind-isolation.spec.js", "--grep=late sheet stays outside photographs"],
  ["specs/translation-services.spec.js", "--grep=translation connections, explicit fallback"],
];
for (const args of runs) {
  const result = spawnSync(process.execPath, [playwright, "test", ...args, "--project=desktop-wide", "--project=mobile", "--update-snapshots=none"], {
    cwd: browserRoot, stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
