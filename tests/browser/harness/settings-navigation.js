/** Select a settings category through the visible desktop or mobile control. */
export async function clickSettingsCategory(button) {
    if (await button.isVisible()) return button.click();
    const panel = await button.getAttribute("data-panel");
    const page = button.page();
    const select = page.locator("#jhs-settings-category");
    const label = await select.locator(`option[value="${panel}"]`).textContent();
    await select.locator("..").getByRole("combobox").click();
    await page.getByRole("option", {name:label, exact:true}).click();
}
