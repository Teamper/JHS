import {describe,expect,it,vi} from "vitest";
import {JSDOM} from "jsdom";
import jquery from "jquery";
import {SettingPlugin} from "../src/plugins/backup/setting.js";


function setup(){const dom=new JSDOM('<main><textarea id="car-number-import"></textarea><select id="car-number-import-status"><option value="">请选择</option><option value="hasDown">已下载</option></select><button id="confirm-car-number-import" disabled></button><p id="car-number-import-help"></p><div id="car-number-import-preview" hidden></div></main>'),$=jquery(dom.window);let confirm;const patch=vi.fn(async()=>{});const plugin=Object.assign(Object.create(SettingPlugin.prototype),{jquery:$,document:dom.window.document,_carImportRevision:0,notifications:{ok:vi.fn(),info:vi.fn(),error:vi.fn()},logger:{warn:vi.fn()},legacyStorage:{getCarList:vi.fn(async()=>[])},getRuntimeService:()=>({patch}),utils:{q:(_event,_message,callback)=>{confirm=callback;}}});return {dom,$,root:$('main'),plugin,patch,confirm:()=>confirm()};}
describe('number import summary and confirmation revisions',()=>{
 it('filters all invalid pending identities before writing chunks and reports skipped items',async()=>{
  const {dom,$,root,plugin,patch,confirm}=setup();
  $('#car-number-import').val(Array.from({length:76},(_,index)=>`ABC-${index+1}`).join(' '));$('#car-number-import-status').val('hasDown');plugin.previewCarNumbers(root);
  plugin.pendingCarImport.values.splice(75,0,'STUDIO-NAME','FC2');
  plugin.confirmCarNumbers(null,root);await confirm();
  expect(patch.mock.calls.map(([values])=>values.length)).toEqual([75,1]);
  expect(patch.mock.calls.flatMap(([values])=>values)).not.toContain('STUDIO-NAME');expect(patch.mock.calls.flatMap(([values])=>values)).not.toContain('FC2');
  expect($('.jhs-import-details section').first().find('li').map((_,item)=>$(item).text()).get()).not.toContain('STUDIO-NAME');
  expect($('#car-number-import-preview').text()).toContain('跳过 2 条无效番号');expect(plugin.notifications.ok).toHaveBeenCalledWith('已导入 76 条，跳过 2 条无效番号');dom.window.close();
 });
 it('shows separate valid, duplicate and invalid counts with safe expandable text',()=>{const {dom,$,root,plugin}=setup();$('#car-number-import').val('ABC-1 abc-1 bad');$('#car-number-import-status').val('hasDown');plugin.previewCarNumbers(root);expect($('.jhs-import-metrics dd').map((_,e)=>$(e).text()).get()).toEqual(['1','1','1']);expect($('.jhs-import-details li').map((_,e)=>$(e).text()).get()).toEqual(['ABC-1','BAD']);expect($('#confirm-car-number-import').prop('disabled')).toBe(false);dom.window.close();});
 it('rejects an old confirmation after inputs change and a new preview is created',async()=>{const {dom,$,root,plugin,patch,confirm}=setup();$('#car-number-import').val('ABC-1');$('#car-number-import-status').val('hasDown');plugin.previewCarNumbers(root);plugin.confirmCarNumbers(null,root);$('#car-number-import').val('ABC-2');plugin.previewCarNumbers(root);await confirm();expect(patch).not.toHaveBeenCalled();dom.window.close();});
 it('retains 75-item chunks and reports a partial failure, while duplicate confirmation writes once',async()=>{const {dom,$,root,plugin,patch,confirm}=setup();$('#car-number-import').val(Array.from({length:76},(_,i)=>`ABC-${i+1}`).join(' '));$('#car-number-import-status').val('hasDown');plugin.previewCarNumbers(root);patch.mockRejectedValueOnce(new Error('fixture write failure'));plugin.confirmCarNumbers(null,root);const run=confirm();await confirm();await run;expect(patch).toHaveBeenCalledTimes(2);expect(patch.mock.calls[0][0]).toHaveLength(75);expect(patch.mock.calls[1][0]).toHaveLength(1);expect($('.jhs-import-metrics dd').map((_,e)=>$(e).text()).get()).toEqual(['1','0','75']);expect($('#car-number-import-preview').text()).toContain('失败 75 条');expect(plugin.logger.warn).toHaveBeenCalled();dom.window.close();});
 it('restores retry after a storage read failure and does not write',async()=>{const {dom,$,root,plugin,patch,confirm}=setup();$('#car-number-import').val('ABC-1');$('#car-number-import-status').val('hasDown');plugin.previewCarNumbers(root);plugin.legacyStorage.getCarList.mockRejectedValueOnce(new Error('read failed'));plugin.confirmCarNumbers(null,root);await confirm();expect(patch).not.toHaveBeenCalled();expect($('#confirm-car-number-import').prop('disabled')).toBe(false);expect(plugin.notifications.error).toHaveBeenCalledWith('读取现有记录失败，请重试');dom.window.close();});
});
