import { clickSettingsCategory } from "../harness/settings-navigation.js";
import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {boot} from '../harness/ui-root-scenes.js';

const enabled=process.env.JHS_UI_COMPARE==='1';
for(const phase of ['before','after']) for(const theme of ['light','dark']) test(`UI comparison ${phase} ${theme}`,async({page,context},info)=>{
 test.skip(!enabled||!['desktop-wide','mobile'].includes(info.project.name),'explicit review captures');
 await boot(page,context,theme,phase==='before'?{userscriptPath:resolve('../../output/ui-root-fix/before.user.js')}:{});
 const folder=resolve('../../output/ui-root-fix/comparison',info.project.name);await mkdir(folder,{recursive:true});
 const capture=async name=>{await page.screenshot({path:resolve(folder,`${phase}-${name}-${theme}.png`)});};
 await capture('toolbar');
 await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean('SettingPlugin').openSettingDialog('data-panel'));
 const dialog=page.locator('.layui-layer').last();await expect(dialog.locator('#saveBtn')).toHaveAttribute('data-jhs-settings-ready','true');
 for(const [panel,anchor] of [['data','#webdav-panel'],['resources','.jhs-resource-card'],['tasks','#task-panel']]){
  await clickSettingsCategory(dialog.locator(`[data-panel="${panel}-panel"]`));
  if(await dialog.locator(anchor).count())await dialog.locator(anchor).first().scrollIntoViewIfNeeded();
  await capture(panel);
 }
 await clickSettingsCategory(dialog.locator('[data-panel="resources-panel"]'));await dialog.locator('#magnet-tag-rule-list').scrollIntoViewIfNeeded();await capture('rules');
 await page.keyboard.press('Escape');
 await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean('HistoryPlugin').openHistory());await expect(page.locator('.tabulator-row').first()).toBeVisible();await capture('history');
 for(const label of ['操作记录','离线任务']){await page.getByRole('button',{name:label,exact:true}).click();await expect(page.locator('.jhs-history-dialog .jhs-card').first()).toBeVisible();await capture(label==='操作记录'?'activity':'offline');}
 await page.keyboard.press('Escape');await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean('NewVideoPlugin').openDialog());await expect(page.locator('.actress-card').first()).toBeVisible();await capture('actor');
 await page.locator('#nvViewList').click();await expect(page.locator('.nv-card')).toHaveCount(60);await capture('new-works');
 await page.keyboard.press('Escape');await page.evaluate(()=>document.querySelector('#statsBtn').click());await expect(page.locator('.jhs-stats')).toBeVisible();await capture('statistics');
 await page.keyboard.press('Escape');await page.evaluate(()=>{window.show.ok('已保存',{duration:-1});window.show.error('资源加载失败，请重试',{duration:-1});});await capture('feedback');
});
