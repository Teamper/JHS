import { clickSettingsCategory } from "../harness/settings-navigation.js";
import { expect, test } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

const groups = ["appearance", "browse", "filtering", "tasks", "resources", "cloud", "data", "advanced"];
const nativeFieldSelector = 'input:not([type="checkbox"],[type="radio"],[type="range"],[type="hidden"],[type="button"],[type="submit"],[type="reset"],[type="image"],[type="color"],[type="file"]),select,textarea';

function measureControls(root) {
  const color = value => {
    const channels = value.match(/[\d.]+/g)?.map(Number);
    if (!channels || channels.length < 3) throw new Error(`Unsupported computed color: ${value}`);
    return [channels[0], channels[1], channels[2], channels[3] ?? 1];
  };
  const over = (foreground, background) => foreground.slice(0, 3).map((channel, index) => channel * foreground[3] + background[index] * (1 - foreground[3])).concat(1);
  const background = element => {
    const ancestors = [];
    for (let current = element; current; current = current.parentElement) ancestors.unshift(current);
    return ancestors.reduce((result, current) => over(color(getComputedStyle(current).backgroundColor), result), [255, 255, 255, 1]);
  };
  const luminance = rgb => {
    const linear = rgb.slice(0, 3).map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const contrast = (left, right) => { const light = luminance(left), dark = luminance(right); return (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05); };
  const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
  const disabled = element => element.matches(":disabled") || element.getAttribute("aria-disabled") === "true";
  const fields = [], switches = [];
  let exempt = 0;
  for (const element of root.querySelectorAll('input:not([type="checkbox"],[type="radio"],[type="range"],[type="hidden"],[type="button"],[type="submit"],[type="reset"],[type="image"],[type="color"],[type="file"]),select,textarea,.jhs-select-trigger')) {
    if (!visible(element)) continue;
    if (disabled(element)) { exempt++; continue; }
    const style = getComputedStyle(element), outside = background(element.parentElement), inside = over(color(style.backgroundColor), outside), border = over(color(style.borderTopColor), inside);
    fields.push({ id: element.id || element.closest(".jhs-select-control")?.querySelector("select")?.id || element.closest("[data-jhs-setting]")?.getAttribute("data-jhs-setting") || element.tagName, trigger: element.matches(".jhs-select-trigger"), borderWidth: parseFloat(style.borderTopWidth), borderStyle: style.borderTopStyle, background: style.backgroundColor, border: style.borderTopColor, foreground: style.color, innerBoundary: contrast(border, inside), outerBoundary: contrast(border, outside), text: contrast(over(color(style.color), inside), inside) });
  }
  for (const element of root.querySelectorAll(".jhs-switch,.mini-switch")) {
    if (!visible(element)) continue;
    if (disabled(element)) { exempt++; continue; }
    const style = getComputedStyle(element), outside = background(element.parentElement), track = over(color(style.backgroundColor), outside), border = over(color(style.borderTopColor), track), thumbStyle = getComputedStyle(element, "::before"), thumb = over(color(thumbStyle.backgroundColor), track);
    switches.push({ id: element.id || element.closest("[data-jhs-setting]")?.getAttribute("data-jhs-setting"), checked: element.checked, border: style.borderTopColor, track: style.backgroundColor, thumb: thumbStyle.backgroundColor, borderWidth: parseFloat(style.borderTopWidth), outerBoundary: contrast(border, outside), offBoundary: contrast(border, track), thumbBoundary: contrast(thumb, track) });
  }
  return { fields, switches, exempt };
}

function assertControls(report, label) {
  for (const field of report.fields) {
    const context = `${label}/${field.id}: ${JSON.stringify(field)}`;
    expect(field.borderWidth, context).toBeGreaterThan(0);
    expect(field.borderStyle, context).not.toBe("none");
    expect(field.innerBoundary, context).toBeGreaterThanOrEqual(3);
    expect(field.outerBoundary, context).toBeGreaterThanOrEqual(3);
    expect(field.text, context).toBeGreaterThanOrEqual(4.5);
  }
  for (const control of report.switches) {
    const context = `${label}/${control.id}: ${JSON.stringify(control)}`;
    expect(control.borderWidth, context).toBeGreaterThan(0);
    expect(control.outerBoundary, context).toBeGreaterThanOrEqual(3);
    if (!control.checked) expect(control.offBoundary, context).toBeGreaterThanOrEqual(3);
    expect(control.thumbBoundary, context).toBeGreaterThanOrEqual(3);
  }
}

for (const theme of ["light", "dark"]) {
  test(`rendered native fields, enhanced selects and switch states meet contrast in ${theme}`, async ({ page, context }, info) => {
    test.skip(!["desktop-wide", "mobile"].includes(info.project.name), "desktop and touch cover actual computed input boundaries");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await fulfillHostFixtures(context);
    await page.goto("https://javdb.com/");
    await injectUserscriptRuntime(page, { hostStyles: true, settingOverrides: { themeMode: theme, enableLoadOtherSite: "no", enableClog: "no" } });
    await page.evaluate(() => window.pluginManager.getBean("SettingPlugin").openSettingDialog());
    const dialog = page.locator(".layui-layer").filter({ has: page.locator("#saveBtn") });
    await expect(dialog.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready", "true");
    const reports = [];
    for (const group of groups) {
      await clickSettingsCategory(dialog.locator(`[data-panel="${group}-panel"]`));
      const panel = dialog.locator(`#${group}-panel`);
      await expect(panel).toBeVisible();
      await page.mouse.move(0, 0);
      const report = await panel.evaluate(measureControls);
      assertControls(report, `${theme}/${info.project.name}/${group}/normal`);
      reports.push({ group, state: "normal", ...report });
      for (const selector of [nativeFieldSelector, ".jhs-select-trigger", ".jhs-switch,.mini-switch"]) {
        const candidates = panel.locator(selector).filter({ visible: true });
        let candidate;
        for (const item of await candidates.all()) if (await item.isEnabled()) { candidate = item; break; }
        if (!candidate) continue;
        await candidate.hover();
        const hovered = await panel.evaluate(measureControls);
        assertControls(hovered, `${theme}/${info.project.name}/${group}/hover`);
        reports.push({ group, state: "hover", ...hovered });
        await page.keyboard.press("Tab");
        await candidate.focus();
        await expect(candidate).toHaveCSS("outline-width", "2px");
        const focused = await panel.evaluate(measureControls);
        assertControls(focused, `${theme}/${info.project.name}/${group}/focus`);
        reports.push({ group, state: "focus", ...focused });
        await candidate.evaluate(element => element.blur());
      }
    }
    const normal = reports.filter(report => report.state === "normal");
    expect(normal.flatMap(report => report.fields).filter(field => field.trigger).length).toBeGreaterThan(0);
    expect(normal.flatMap(report => report.fields).filter(field => !field.trigger).length).toBeGreaterThan(0);
    const choices = dialog.locator('input[type="checkbox"]');
    expect(await choices.count()).toBeGreaterThan(0);
    await expect(dialog.locator('input[role="switch"]')).toHaveCount(0);
    const states = await choices.evaluateAll(nodes => nodes.map(node => node.checked));
    expect(states.includes(true)).toBe(true); expect(states.includes(false)).toBe(true);
    await info.attach(`computed-control-contrast-${theme}.json`, { body: JSON.stringify(reports, null, 2), contentType: "application/json" });
  });
}
