// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { SettingPlugin } from "../src/plugins/backup/setting.js";
import { SettingsRegistry } from "../src/app/settings-registry.js";
import { registerDefaultSettings } from "../src/app/settings-catalog.js";
import { SettingsService } from "../src/services/settings-service.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { getPluginCategories } from "../src/plugins/backup/setting-templates.js";
import { renderPluginMgmtPanel, renderSnapshotPanel, showDiffPreview } from "../src/plugins/backup/setting-panels.js";
import { HistoryDialogController } from "../src/features/library/history-dialog-controller.js";
import { DetailStateController } from "../src/core/detail-state-controller.js";
import { ListBatchController } from "../src/features/list/list-batch-controller.js";
import { ListBatchUi } from "../src/features/list/list-batch-ui.js";
import { createListEvaluationContext } from "../src/features/list/list-evaluator.js";
import { backupListBtnByWebDav, openFileListDialog } from "../src/plugins/backup/setting-backup.js";

vi.mock("../src/core/credential-crypto.js", () => ({decryptCredential: vi.fn(), decryptPortableBackup: vi.fn(async value => value), encryptPortableBackup: vi.fn(async value => value)}));
const deferred = () => { let resolve, reject; const promise = new Promise((yes,no) => {resolve=yes;reject=no;}); return {promise,resolve,reject}; };
beforeEach(() => { document.body.replaceChildren(); vi.stubGlobal("storageManager", {}); vi.stubGlobal("$", jquery); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

function settingsHarness() {
    const options=[], registry=new SettingsRegistry(); registerDefaultSettings(registry);
    const settings=new SettingsService({get:async()=>({}),set:async()=>{}});
    const plugin=new SettingPlugin({runtimeServices:{settings, settingsRegistry:registry,dialog:{open:vi.fn(value=>{options.push(value);return options.length;}),close:vi.fn(id=>options[id-1]?.end())}},capabilities:{},jquery,utilities:{getDialogArea:()=>["700px","600px"],trapFocus:vi.fn(()=>vi.fn()),setupEscClose:vi.fn()},notifications:{},logger:{},legacyStorage:{},events:{on:vi.fn(()=>vi.fn())},document,window});
    plugin.renderTaskStatuses=plugin.bindClick=vi.fn(); plugin.activateSettingPanel=vi.fn();
    plugin.hydrateSettingForm=plugin.loadResourceSettings=vi.fn(async()=>{});
    plugin.hydrateLiveSettings=vi.fn(()=>({dispose:vi.fn()}));
    return {plugin,options, mount:async option=>{const root=jquery("<div></div>").append(option.content).appendTo(document.body);await option.success(root,options.indexOf(option)+1);return root;}};
}
describe("settings instance and management",()=>{
    it("keeps shortcut styles inside the vendor style envelope",async()=>{
        const {plugin}=settingsHarness();plugin.utils.isMobileMode=()=>false;
        const css=await plugin.initCss();
        const content=css.replace(/^\s*<style>|<\/style>\s*$/g,"");
        expect(content).not.toMatch(/<\/?style>/);
        expect(content).toContain(".jhs-shortcut-fields");
        const style=document.createElement("style");style.textContent=content;document.head.append(style);
        expect([...style.sheet.cssRules].some(rule=>rule.selectorText===".jhs-shortcut-fields")).toBe(true);
        style.remove();
    });
    it("merges pending full settings requests, opens the latest panel, and ignores an old repeated end",async()=>{
        const {plugin,options,mount}=settingsHarness();
        await Promise.all([plugin.openSettingDialog("appearance-panel"),plugin.openSettingDialog("data-panel")]);
        expect(options).toHaveLength(1);await mount(options[0]);
        expect(plugin.activateSettingPanel).toHaveBeenLastCalledWith(expect.anything(),"data-panel");
        await plugin.openSettingDialog("advanced-panel");expect(options).toHaveLength(1);
        expect(plugin.activateSettingPanel).toHaveBeenLastCalledWith(expect.anything(),"advanced-panel");
        options[0].end();expect(plugin._fullSettingBinding).toBeNull();await plugin.openSettingDialog();await mount(options[1]);const binding=plugin._fullSettingBinding;
        options[0].end();expect(plugin._fullSettingBinding).toBe(binding);expect(binding.dispose).not.toHaveBeenCalled();options[1].end();
    });
    it("unlinks normal close from its feature owner and cancels a pending open on disposal",async()=>{
        const {plugin,options,mount}=settingsHarness();plugin._settingScope=new LifecycleScope("settings-feature");
        await plugin.openSettingDialog();await mount(options[0]);options[0].end();
        expect(plugin._settingsDialog).toBeNull();expect(plugin._fullSettingBinding).toBeNull();expect(plugin._settingScope.cleanups.size).toBe(0);expect(plugin.runtimeServices.dialog.close).not.toHaveBeenCalled();
        const pending=plugin.openSettingDialog();plugin._settingScope.dispose();await pending;expect(options).toHaveLength(1);expect(plugin._settingsDialog).toBeNull();
    });
    it("exposes every previously omitted controllable contribution in an existing category",()=>{
        const {categories}=getPluginCategories(), ids=Object.values(categories).flatMap(category=>category.plugins);
        for(const id of ["Fc2NavigationPlugin","DetailWorkspacePlugin","OneOneFiveMatchPlugin","UnifiedOfflinePlugin","CompatibilityEnhancementsPlugin"])expect(ids).toContain(id);
    });
    it("atomically preserves concurrent plugin choices and unknown disabled identifiers",async()=>{
        document.body.innerHTML='<div id="plugin-mgmt-list"></div><span id="pm-total"></span><span id="pm-enabled"></span><span id="pm-disabled"></span>';
        let stored={disabledPlugins:'["future.contribution"]'};
        const write=vi.fn(async(_key,value)=>{stored={...value};}), settings=new SettingsService({get:async()=>stored,set:write});await settings.load();
        const deps={jquery,legacyStorage:{getSetting:async()=>stored.disabledPlugins,getCacheHitStats:()=>({})},notifications:{ok:vi.fn(),error:vi.fn()},logger:{error:vi.fn()},domUi:{},window};
        const diagnostics={exportSnapshot:()=>({legacyPluginDescriptors:[{name:"AutoPagePlugin",disableable:true},{name:"NewVideoPlugin",disableable:true}],legacyPlugins:[],legacyTimings:[],activeFeatures:[],errors:[]})};
        await renderPluginMgmtPanel(diagnostics,settings,deps);
        jquery('[data-plugin="AutoPagePlugin"]').prop("checked",false).trigger("change");jquery('[data-plugin="NewVideoPlugin"]').prop("checked",false).trigger("change");
        await settings.waitForIdle();expect(JSON.parse(stored.disabledPlugins).sort()).toEqual(["discovery.new-video","future.contribution","list.auto-page"]);
        write.mockRejectedValueOnce(new Error("failed"));jquery('[data-plugin="AutoPagePlugin"]').prop("checked",true).trigger("change");
        await vi.waitFor(()=>expect(deps.notifications.error).toHaveBeenCalledOnce());expect(jquery('[data-plugin="AutoPagePlugin"]').prop("checked")).toBe(false);
    });
});

function historyHarness(patch) {
    let options;const close=vi.fn(), errors=vi.fn();
    const controller=new HistoryDialogController({document,window,jquery,domUi:{getDialogArea:()=>[],confirm:(_e,_m,accept)=>accept()},dialog:{open:value=>{options=value;return 1;},close},notifications:{error:errors},logger:{error:vi.fn()},clipboard:{},movie:{},settings:{snapshot:()=>({})},storage:{},state:{},repository:{patch},site:"javdb"});
    controller.tableObj={setData:vi.fn(async()=>{})};
    const open=async()=>{await controller.editRecord({carNum:"ABC-1",stateFlags:{favorite:true}});const root=jquery('<div><a class="layui-layer-btn0"></a></div>').append(options.content).appendTo(document.body);options.success(root,1);return root;};
    return {controller,close,errors,open,get options(){return options;}};
}
describe("history and detail action ownership",()=>{
    it.each(["closed", "replaced", "view"])("keeps a committed history edit successful after parent changes (%s)",async change=>{
        const pending=deferred(), patch=vi.fn(()=>pending.promise), harness=historyHarness(patch);await harness.open();
        const save=harness.options.yes(1);await harness.options.yes(1);expect(patch).toHaveBeenCalledOnce();const replacement={setData:vi.fn()};if(change==="closed"){harness.controller.tableObj=null;harness.controller.historyDialogGeneration++;}else if(change==="replaced")harness.controller.tableObj=replacement;else harness.controller.historyViewGeneration++;
        pending.resolve();await save;expect(harness.errors).not.toHaveBeenCalled();expect(harness.close).toHaveBeenCalledWith(1);expect(replacement.setData).not.toHaveBeenCalled();
    });
    it("retains history drafts on write failure and permits a later retry",async()=>{
        const patch=vi.fn().mockRejectedValueOnce(Error("failed")).mockResolvedValueOnce(), harness=historyHarness(patch), root=await harness.open();root.find("#edit-remark").val("draft");
        await harness.options.yes(1);expect(harness.close).not.toHaveBeenCalled();expect(root.find("#edit-remark").val()).toBe("draft");expect(harness.errors).toHaveBeenCalledWith("记录保存失败，请重试");
        await harness.options.yes(1);expect(harness.close).toHaveBeenCalledWith(1);
    });
    it("does not prompt or write when the detail owner closes during its state read",async()=>{
        const pending=deferred(), confirm=vi.fn(), toggle=vi.fn();document.body.innerHTML='<div id="owner"><button id="filterBtn"></button></div>';
        const root=jquery("#owner"), controller=new DetailStateController({toggle},{jquery,readState:()=>pending.promise,confirm,reportError:vi.fn(),logError:vi.fn()});
        const action=controller.requestToggle({root,carNum:"ABC-1",selectors:{}},"blocked");root.remove();pending.resolve({stateFlags:{}});await action;expect(confirm).not.toHaveBeenCalled();expect(toggle).not.toHaveBeenCalled();
    });
    it("reports a failed state read without an unhandled action rejection",async()=>{
        document.body.innerHTML='<div id="owner"></div>';const reportError=vi.fn(),controller=new DetailStateController({},{jquery,readState:async()=>{throw Error("read failed");},reportError,logError:vi.fn()});
        await expect(controller.requestToggle({root:jquery("#owner"),carNum:"ABC-1",selectors:{}},"favorite")).resolves.toBeUndefined();expect(reportError).toHaveBeenCalledWith("状态读取失败，请重试");
    });
    it("checks feature scope again after record preparation and before a state write",async()=>{
        document.body.innerHTML='<div id="owner"><button id="favoriteBtn"></button></div>';const pending=deferred(),toggle=vi.fn(),scope={disposed:false},controller=new DetailStateController({toggle},{jquery,readState:async()=>({}),logError:vi.fn(),reportError:vi.fn()});
        const action=controller.toggle({root:jquery("#owner"),carNum:"ABC-1",selectors:{},scope,getRecord:()=>pending.promise},"favorite");scope.disposed=true;pending.resolve({});await action;expect(toggle).not.toHaveBeenCalled();
    });
});

describe("batch partial completion",()=>{
    it("keeps a visible exact result after the second write chunk fails",async()=>{
        vi.useFakeTimers();document.body.innerHTML=Array.from({length:76},(_,i)=>`<div class="item"><a href="/v/${i}"><div class="video-title"><strong>ABC-${i+1}</strong> title</div></a></div>`).join("");
        const notifications={error:vi.fn()},ui=new ListBatchUi({document,dialog:{},notifications}),patch=vi.fn().mockResolvedValueOnce().mockRejectedValueOnce(Error("failed"));
        const controller=new ListBatchController({hostAdapter:{getPageContext:()=>({kind:"search"}),getListSelectors:()=>({requestDomItemSelector:".item",nextPageSelector:".next"}),resolveFirstPageUrl:url=>url},state:{patch},scope:{disposed:false},http:{},ui,document,location:{href:"https://javdb.com/search?q=test",search:""},getEvaluationContext:async()=>createListEvaluationContext()});
        await expect(controller.run({kind:"search"},"favorite",{confirm:false,filter:"all"})).rejects.toThrow("failed");
        const progress=document.querySelector("#jhs-batch-progress");expect(progress.textContent).toContain("已完成 75 项，剩余 1 项未完成");expect(progress.querySelector("#jhs-batch-cancel").hidden).toBe(true);expect(notifications.error).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(5000);expect(progress.isConnected).toBe(true);progress.querySelector("button:last-child").click();expect(progress.isConnected).toBe(false);controller.dispose();ui.dispose();
    });
});

function backupDependencies(scope) {
    const closeLoading=vi.fn();return {jquery,document,window,scope,isActive:()=>!scope.disposed,legacyStorage:{exportData:vi.fn(async()=>({})),diffData:vi.fn(async()=>({}))},utilities:{isMobileMode:()=>false,getResponsiveArea:()=>[],getNowStr:()=>"2026-10-15"},notifications:{ok:vi.fn(),error:vi.fn()},logger:{error:vi.fn()},domUi:{loading:()=>({close:closeLoading})},closeLoading};
}
describe("backup window ownership",()=>{
    it.each([true,false])("formats missing backup dates as absent instead of current time (mobile=%s)", mobile => {
        const scope = new LifecycleScope("backup-dates"), deps = backupDependencies(scope), values = [undefined, null, "invalid", "2026-10-15T08:09:10"];
        deps.utilities.isMobileMode = () => mobile;
        deps.utilities.getNowStr = vi.fn(() => "unexpected-current-time");
        let dates, options;
        deps.domUi.tableConstructor = class {
            constructor(_target, config) { const column = config.columns.find(column => column.field === "createTime"); dates = config.data.map(file => column.formatter({ getValue: () => file.createTime })); }
            destroy() {}
        };
        const dialog = { open(value) { options = value; const root = jquery("<div></div>").append(value.content).appendTo(document.body); value.success(root[0]); return 1; }, close() { options.end(); } };
        openFileListDialog(values.map((createTime, index) => ({ name: `backup-${index}.json`, fileId: String(index), size: 1, createTime })), {}, "WebDAV", "JHS", vi.fn(), dialog, deps);
        if (mobile) dates = jquery(".jhs-backup-card-meta").map((_index, node) => node.textContent.replace("1 B · ", "")).get();
        expect(dates).toEqual(["无", "无", "无", "2026-10-15 08:09:10"]);
        expect(deps.utilities.getNowStr).not.toHaveBeenCalled();
        scope.dispose();
    });
    it("destroys the snapshot table and discards pending snapshot lists when its owner closes",async()=>{
        document.body.innerHTML='<div id="snapshot-list"></div>';const scope=new LifecycleScope("snapshot-owner"),deps=backupDependencies(scope),destroy=vi.fn();deps.legacyStorage.getSnapshotList=vi.fn(async()=>[{id:"id-1"}]);deps.domUi.tableConstructor=class {destroy=destroy;};
        await renderSnapshotPanel(deps);scope.dispose();expect(destroy).toHaveBeenCalledOnce();
        const nextScope=new LifecycleScope("snapshot-next"),nextDeps=backupDependencies(nextScope),pending=deferred(),construct=vi.fn();nextDeps.legacyStorage.getSnapshotList=()=>pending.promise;nextDeps.domUi.tableConstructor=construct;
        const loading=renderSnapshotPanel(nextDeps);nextScope.dispose();pending.resolve([]);await loading;expect(construct).not.toHaveBeenCalled();
    });
    it("does not revive a closed settings window when the backup list finishes loading",async()=>{
        const scope=new LifecycleScope("settings-test"),deps=backupDependencies(scope),pending=deferred(),open=vi.fn();
        const work=backupListBtnByWebDav("JHS",open,{getProfile:async()=>({url:"https://example.invalid",username:"u",password:"synthetic"}),createClient:()=>({getBackupList:()=>pending.promise})},deps);
        await Promise.resolve();await Promise.resolve();scope.dispose();pending.resolve([]);await work;expect(open).not.toHaveBeenCalled();expect(deps.closeLoading).toHaveBeenCalledOnce();
    });
    it.each([true,false])("cleans list resources and ignores late import results (mobile=%s)",async mobile=>{
        const scope=new LifecycleScope("settings-test"),deps=backupDependencies(scope),pending=deferred(),preview=vi.fn(),destroy=vi.fn();deps.utilities.isMobileMode=()=>mobile;
        let options,root;const dialog={open:value=>{options=value;root=jquery("<div></div>").append(value.content).appendTo(document.body);value.success(root[0]);return 1;},close:()=>{options.end();root.remove();},confirm:vi.fn()};
        deps.domUi.tableConstructor=class {constructor(target,config){target.innerHTML=config.columns.at(-1).formatter({getData:()=>config.data[0]});} destroy=destroy;};
        openFileListDialog([{name:"synthetic.json",fileId:"id-1",size:1,createTime:1}],{getFileContent:()=>pending.promise},"WebDAV","JHS",preview,dialog,deps);
        root.find('[data-backup-action="import"]').trigger("click");scope.dispose();pending.resolve('{}');await Promise.resolve();await Promise.resolve();
        expect(preview).not.toHaveBeenCalled();expect(deps.closeLoading).toHaveBeenCalledOnce();if(!mobile)expect(destroy).toHaveBeenCalledOnce();
    });
    it("cancels before atomic commit when the import preview closes",async()=>{
        const scope=new LifecycleScope("settings-test"),deps=backupDependencies(scope),pending=deferred();let committed=false,options;
        deps.legacyStorage.createSnapshot=vi.fn();
        deps.legacyStorage.importData=vi.fn(async (_data,guard)=>{await pending.promise;guard.assertActive();committed=true;});
        showDiffPreview({summary:{added:1},stores:{setting:{status:"modified",oldCount:1,newCount:1,added:[],removed:[],modified:[1]}}},{setting:{}},null,{open:value=>{options=value;return 1;},close:()=>options.end()},deps);
        const action=options.yes(1);await options.yes(1);expect(deps.legacyStorage.importData).toHaveBeenCalledOnce();options.end();pending.resolve();await action;
        expect(committed).toBe(false);expect(deps.legacyStorage.createSnapshot).not.toHaveBeenCalled();expect(deps.closeLoading).toHaveBeenCalledOnce();scope.dispose();
    });;
});
