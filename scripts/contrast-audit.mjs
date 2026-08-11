import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * WCAG 对比度审计：从 src/core/theme.js 提取 --jhs-* 令牌并校验关键颜色组合。
 * 文字(普通) >= 4.5:1，UI 边界/输入框边框 >= 3:1。任一 FAIL 则 exit 1。
 * 接入 npm run check 作为 CI 门禁。
 */

const repoRoot = join(import.meta.dirname, "..");
const themeSource = await readFile(join(repoRoot, "src", "core", "theme.js"), "utf8");

const DARK_MARKER = ':root[data-jhs-theme="dark"] {';
const darkIdx = themeSource.indexOf(DARK_MARKER);
if (darkIdx < 0) {
  console.error("FAIL: theme.js missing dark theme block :root[data-jhs-theme=\"dark\"]");
  process.exit(1);
}

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function ratio(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function extractTokens(source) {
  const tokens = {};
  const re = /--jhs-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g;
  let m;
  while ((m = re.exec(source))) tokens[m[1]] = m[2].toLowerCase();
  return tokens;
}

const themes = {
  light: { name: "light", tokens: extractTokens(themeSource.slice(0, darkIdx)) },
  dark: { name: "dark", tokens: extractTokens(themeSource.slice(darkIdx)) }
};

let failures = 0;

function assertPair(theme, label, fgToken, bgToken, min) {
  const { tokens } = theme;
  const fg = tokens[fgToken];
  const bg = tokens[bgToken];
  if (!fg || !bg) {
    const missing = [!fg && fgToken, !bg && bgToken].filter(Boolean).join(", ");
    console.log(`FAIL [${theme.name}] ${label}: missing token(s) ${missing}`);
    failures++;
    return;
  }
  const r = ratio(fg, bg);
  if (r < min) {
    console.log(`FAIL [${theme.name}] ${label}: ${fg} on ${bg} = ${r.toFixed(2)}:1 (need >= ${min})`);
    failures++;
  }
}

const TEXT_TARGET = 4.5;
const BOUNDARY_TARGET = 3;

for (const theme of Object.values(themes)) {
  // 中性文字
  for (const t of ["text", "text-muted", "text-faint"]) {
    assertPair(theme, `${t} on surface`, t, "surface", TEXT_TARGET);
    assertPair(theme, `${t} on surface-2`, t, "surface-2", TEXT_TARGET);
  }
  // 输入框 / 禁用态
  assertPair(theme, "placeholder on input-bg", "placeholder", "input-bg", TEXT_TARGET);
  assertPair(theme, "disabled-text on disabled-bg", "disabled-text", "disabled-bg", TEXT_TARGET);
  // 边界
  assertPair(theme, "border-strong on surface (UI boundary)", "border-strong", "surface", BOUNDARY_TARGET);
  // 状态语义色
  for (const s of ["filter", "fav", "down", "watch"]) {
    assertPair(theme, `${s}-on on ${s}`, `status-${s}-on`, `status-${s}`, TEXT_TARGET);
    assertPair(theme, `${s}-on on ${s}-hover`, `status-${s}-on`, `status-${s}-hover`, TEXT_TARGET);
    assertPair(theme, `${s}-text on ${s}-tint`, `status-${s}-text`, `status-${s}-tint`, TEXT_TARGET);
  }
  // 主操作色
  assertPair(theme, "accent-text-on on accent", "accent-text-on", "accent", TEXT_TARGET);
  assertPair(theme, "accent-text-on on accent-hover", "accent-text-on", "accent-hover", TEXT_TARGET);
  // 通用反馈语义
  assertPair(theme, "danger-text-on on danger", "danger-text-on", "danger", TEXT_TARGET);
  assertPair(theme, "danger on danger-tint", "danger", "danger-tint", TEXT_TARGET);
  assertPair(theme, "warning-text-on on warning", "warning-text-on", "warning", TEXT_TARGET);
  assertPair(theme, "warning on warning-tint", "warning", "warning-tint", TEXT_TARGET);
  // 品牌色
  assertPair(theme, "brand-javdb on surface", "brand-javdb", "surface", TEXT_TARGET);
  assertPair(theme, "brand-javbus on surface", "brand-javbus", "surface", TEXT_TARGET);
  // 代码查看器 (终端语义)
  assertPair(theme, "code-text on code-bg", "code-text", "code-bg", TEXT_TARGET);
  assertPair(theme, "code-line on code-bg", "code-line", "code-bg", TEXT_TARGET);
}

if (failures > 0) {
  console.error(`Contrast audit FAILED: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("Contrast audit passed: light + dark tokens meet WCAG AA targets (text >= 4.5, boundary >= 3)");
