/** Follow visible entry points, including compact and portaled menus. */
export async function openDetailEnhancements(page) {
    const menu = page.locator(".jhs-detail-extra-actions").first();
    if (!await menu.evaluate(node => node.open)) await menu.locator(":scope > summary").click();
}

export async function enterMovieSelection(page) {
    const desktop = page.locator('.jhs-commandbar__batch > button');
    if (await desktop.isVisible()) {
        await desktop.click();
        await page.getByRole("menuitem", { name: "进入 / 退出选择", exact: true }).click();
        return;
    }
    await page.locator("#jhs-fab").click();
    await page.locator('#jhs-fab-menu [data-action="batch"]').click();
    await page.getByRole("menuitem", { name: "进入 / 退出选择", exact: true }).click();
    await page.keyboard.press("Escape");
}

export async function openUtility(page, name) {
    await page.locator("#jhs-private-tools,#jhs-fab").first().waitFor({state:"attached"});
    const desktop = page.locator("#jhs-private-tools").locator("button").filter({hasText:new RegExp("^" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$")});
    if (!await page.locator("#jhs-fab").isVisible()) {
        await desktop.waitFor({state:"attached"});
        if (!await desktop.isVisible()) {
            const more = page.locator('.jhs-commandbar__more > button');
            if (await more.isVisible()) await more.click();
            else await openDetailEnhancements(page);
        }
        return desktop;
    }
    const menu = page.locator("#jhs-fab-menu");
    if (await menu.getAttribute("aria-hidden") !== "false") await page.locator("#jhs-fab").click();
    return menu.getByRole("menuitem", { name, exact: true });
}
