import { clickSettingsCategory } from "../harness/settings-navigation.js";
import {test,expect} from "@playwright/test";
import {boot} from "../harness/ui-root-scenes.js";
import {mkdir} from "node:fs/promises";
import {resolve} from "node:path";

async function capture(page,info,name){
  const folder=resolve("../../output/ui-root-fix",info.project.name); await mkdir(folder,{recursive:true});
  await page.screenshot({path:resolve(folder,`${name}.png`)});
  if(process.env.JHS_VISUAL_REGRESSION==="1" && ["desktop-wide","mobile"].includes(info.project.name)) await expect.soft(page).toHaveScreenshot(`root-${name}.png`,{maxDiffPixelRatio:.02});
}
async function contained(locator){
  const bad=await locator.evaluate(root=>[...root.querySelectorAll('.jhs-field,.jhs-select-trigger,.jhs-choice,.jhs-metric,.nv-card,.jhs-record-card')].filter(node=>node.getBoundingClientRect().width && node.scrollWidth>node.clientWidth+2).map(node=>node.className));
  expect(bad).toEqual([]);
}
for(const theme of ["light","dark"]){
  test(`rich settings and portal geometry ${theme}`,async({page,context},info)=>{
    await boot(page,context,theme);
    await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog("car-number-import-panel"));
    const dialog=page.locator('.layui-layer').last(); await expect(dialog.locator('#saveBtn')).toHaveAttribute('data-jhs-settings-ready','true');
    await clickSettingsCategory(dialog.locator('[data-panel="data-panel"]'));
    const textarea=dialog.locator('textarea').filter({visible:true}).last(); await textarea.scrollIntoViewIfNeeded();
    const geometry=await textarea.evaluate(node=>({input:node.getBoundingClientRect().width,row:node.closest('.jhs-setting-row').getBoundingClientRect().width}));
    expect(geometry.input).toBeGreaterThan(geometry.row*.9); await contained(dialog); await capture(page,info,`settings-data-${theme}`);
    await clickSettingsCategory(dialog.locator('[data-panel="resources-panel"]'));
    const source=dialog.locator('.jhs-resource-card').first(); await source.scrollIntoViewIfNeeded();
    const alignment=await source.evaluate(node=>{const toggle=node.querySelector('input[type=checkbox]').getBoundingClientRect(),test=node.querySelector('.jhs-source-test').getBoundingClientRect();return Math.abs((toggle.top+toggle.bottom)/2-(test.top+test.bottom)/2);});
    expect(alignment).toBeLessThan(4); await capture(page,info,`settings-sources-${theme}`);
    await clickSettingsCategory(dialog.locator('[data-panel="browse-panel"]'));
    const trigger=dialog.locator('.jhs-select-trigger:visible').last(); await trigger.scrollIntoViewIfNeeded(); await trigger.click();
    const menu=page.locator('body > .jhs-owned-popover'); await expect(menu).toBeVisible();
    const bounds=await menu.boundingBox(), viewport=page.viewportSize();
    expect(bounds.x).toBeGreaterThanOrEqual(7); expect(bounds.x+bounds.width).toBeLessThanOrEqual(viewport.width-7); expect(bounds.y+bounds.height).toBeLessThanOrEqual(viewport.height-7);
    await capture(page,info,`settings-menu-${theme}`);
    await page.setViewportSize({width:viewport.width-20,height:viewport.height});
    await expect.poll(async()=>{const rect=await menu.boundingBox();return rect.x+rect.width;}).toBeLessThanOrEqual(viewport.width-27);
    await page.setViewportSize(viewport);
    await page.keyboard.press('End'); await page.keyboard.press('Home'); await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0); await expect(trigger).toBeFocused(); await expect(dialog).toBeVisible();
    await expect(dialog.locator('#saveBtn')).toHaveAttribute('data-jhs-dirty-count','0');
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  });
  test(`rich new works and actor editing ${theme}`,async({page,context},info)=>{
    await boot(page,context,theme); await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean('NewVideoPlugin').openDialog());
    const actor=page.locator('.actress-card').first(); await expect(actor).toBeVisible(); const before=await actor.boundingBox();
    if(page.viewportSize().width>=1280)expect(before.width).toBeLessThan(500);
    const alias=await actor.locator('.actress-card-allname').boundingBox(); expect(alias.x+alias.width).toBeLessThanOrEqual(before.x+before.width-12);
    await expect(page.locator('.jhs-task-times').first()).toContainText('2026');
    await actor.getByRole('button',{name:'更多操作'}).click(); await expect(page.locator('body > .jhs-owned-popover')).toBeVisible();
    expect((await actor.boundingBox()).height).toBe(before.height); await capture(page,info,`actor-menu-${theme}`);
    await page.getByRole('menuitem',{name:'编辑资料'}).click(); await expect(page.locator('.layui-layer-title').last()).toContainText('编辑');
    await page.keyboard.press('Escape'); await page.locator('#nvViewList').click(); await expect(page.locator('#nv-grid .nv-card')).toHaveCount(60);
    const card=page.locator('#nv-grid .nv-card').first(); const inset=await card.evaluate(node=>node.querySelector('.nv-card__cover').getBoundingClientRect().left-node.getBoundingClientRect().left);
    expect(inset).toBeGreaterThanOrEqual(12); await card.locator('.nv-select').check(); await contained(page.locator('.newVideoToolBox'));
    await page.mouse.move(0,0); await expect(page.getByRole('tooltip')).toHaveCount(0); await capture(page,info,`new-works-${theme}`);
    await page.locator('#nv-pagination-bar').scrollIntoViewIfNeeded(); await expect(page.locator('#nv-pagination-bar')).toBeInViewport({ratio:1});
    await page.keyboard.press('Escape'); await expect(page.locator('body > .jhs-owned-popover')).toHaveCount(0);
  });
  test(`rich records and uniform metrics ${theme}`,async({page,context},info)=>{
    await boot(page,context,theme); await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean('HistoryPlugin').openHistory());
    const dialog=page.locator('.jhs-history-dialog'); await expect(dialog.locator('.tabulator-row')).not.toHaveCount(0);
    const selectAll=dialog.locator('.jhs-history-select-all');
    await expect(selectAll).toBeVisible();
    expect(await selectAll.evaluate(node=>{const rect=node.getBoundingClientRect(),cell=node.closest('.tabulator-col').getBoundingClientRect();return rect.left>=cell.left&&rect.right<=cell.right;})).toBe(true);
    await dialog.locator('.tabulator-row').first().scrollIntoViewIfNeeded();
    const hitGeometry=await dialog.locator('.tabulator-row').first().evaluate(row=>{const viewport=row.closest('.tabulator-tableholder').getBoundingClientRect();return {overflow:row.getBoundingClientRect().right-viewport.right,buttons:[...row.querySelectorAll('.tabulator-cell button')].filter(node=>node.getBoundingClientRect().width).map(node=>{const rect=node.getBoundingClientRect(),hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);return {width:rect.width,height:rect.height,hit:node.contains(hit)};})};});
    expect(hitGeometry.overflow).toBeLessThanOrEqual(1);
    for(const button of hitGeometry.buttons){expect(button.hit).toBe(true);if(info.project.use.hasTouch){expect(button.width).toBeGreaterThanOrEqual(44);expect(button.height).toBeGreaterThanOrEqual(44);}}
    await dialog.locator('.jhs-details-toggle').first().click(); await expect(dialog.locator('.jhs-history-details').first()).toBeVisible();
    const backgrounds=await dialog.locator('.tabulator-row').first().evaluate(row=>[getComputedStyle(row).backgroundColor,getComputedStyle(row.querySelector('.tabulator-responsive-collapse')).backgroundColor]);
    expect(backgrounds[0]).toBe(backgrounds[1]);
    await capture(page,info,`records-expanded-${theme}`);
    const lastPage=dialog.locator('.tabulator-page[data-page=last]'); await lastPage.scrollIntoViewIfNeeded(); await expect(lastPage).toBeInViewport({ratio:1});
    for(const [label,scene] of [['操作记录','activity'],['离线任务','offline']]){
      await dialog.getByRole('button',{name:label,exact:true}).click(); await expect(dialog.locator('.jhs-record-card')).toHaveCount(8);
      await expect.poll(()=>dialog.locator('.jhs-record-card').evaluateAll(nodes=>nodes[1].getBoundingClientRect().top-nodes[0].getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(12);
      await contained(dialog); await capture(page,info,`${scene}-${theme}`);
    }
    await page.keyboard.press('Escape'); await page.evaluate(()=>document.querySelector('#statsBtn').click());
    const metrics=page.locator('.jhs-stats .jhs-metric'); await expect(metrics.first()).toBeVisible();
    const boxes=await metrics.evaluateAll(nodes=>nodes.map(node=>({height:node.getBoundingClientRect().height,align:getComputedStyle(node).textAlign,pad:getComputedStyle(node).paddingLeft})));
    for(const box of boxes){expect(box.height).toBeGreaterThanOrEqual(96);expect(box.align).toBe('left');expect(box.pad).toBe('16px');}
    await contained(page.locator('.jhs-stats')); await capture(page,info,`statistics-${theme}`);
  });
}
