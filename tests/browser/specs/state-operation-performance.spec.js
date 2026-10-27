import { test, expect } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";

test.use({ trace: "off", screenshot: "off" });
const sampleCount = Math.min(30, Math.max(1, Number.parseInt(process.env.JHS_STATE_PERF_SAMPLES || "1", 10) || 1));
for (const count of [3000, 10000]) for (const sync of [false, true]) test(`mark and offline persistence ${count} movies sync=${sync}`, async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop-wide", "fixed persistence benchmark");
  test.setTimeout(180000);
  await fulfillHostFixtures(context); await page.goto("https://javdb.com/");
  await injectUserscriptRuntime(page, { settingOverrides: { autoPage: "no", enableTranslation: "no", enableCheckBlacklist: "no", enableCheckFavoriteActress: "no", enableCheckNewVideo: "no" }, beforeUserscriptInjection: async page => {
    await page.evaluate(async count => {
      const f = window.localforage.createInstance({ name: "JAV-JHS", storeName: "appData" });
      await f.setItem("car_list", Array.from({ length: count }, (_, i) => ({ carNum: "LIB-" + i, names: "Synthetic title " + i, url: "https://javdb.com/v/fixture-" + i, stateFlags: { favorite: false } })));
      await f.setItem("favorite_actresses", Array.from({ length: 100 }, (_, i) => ({ starId: "actor-" + i, name: "Synthetic actor", newVideoList: Array.from({ length: 60 }, (_, j) => ({ carNum: "NEW-" + (i * 60 + j), title: "New work fixture" })) })));
      await f.setItem("activity_log", { entries: Array.from({ length: 1000 }, (_, i) => ({ id: "history-" + i, type: "state-patch", commitState: "committed", createdAt: "2026-10-20T00:00:00.000Z", changes: [{ carNum: "LIB-" + i, fields: ["stateFlags.favorite"], before: { names: "Previous title", stateFlags: { favorite: false } }, after: { names: "Previous title", stateFlags: { favorite: true } }, undoState: "pending" }] })) });
    }, count);
  } });
  const measurements = await page.evaluate(async ({ sync, sampleCount }) => {
    const service = window.unsafeWindow.pluginManager.getBean("SettingPlugin").getRuntimeService("webdavSync");
    service.cancel(); service.schedule = () => {}; service.reschedule = async () => {};
    service.deps.shared.migrate = async () => {};
    service.deps.shared.snapshot = async () => ({ revision: "fixture", profile: { url: "https://fixture.invalid/dav", username: "synthetic", password: "synthetic" } });
    service.deps.shared.paused = async () => false;
    const files = new Map();
    service.deps.webdav.createClient = () => ({ ensureFolder: async () => {}, listSyncFiles: async () => [...files.values()].map(v => v.meta), readSyncFile: async n => files.get(n)?.content ?? null, writeSyncFile: async (name, content) => { const s=await service.deps.store.read();files.set(name,{content,meta:{...s.pending,schema:1,replicaId:s.replicaId}}); }, deleteSyncFile: async name => files.delete(name) });
    if (sync) { await service.check(); if (service.message) throw new Error(service.message); }
    else service.deps.store.enabled = false;
    // Discovery scans are disabled above: this benchmark measures state writes,
    // not incidental actor requests after the startup quiet period.
    // Measure durable foreground commits separately from actively running sync
    // (covered by responsive-sync-performance); quiet-gate timing must not
    // unpredictably start an automatic reconcile halfway through these samples.
    service.deps.store.deps.backgroundWork = { waitForTurn: () => new Promise(() => {}) };
    const state = window.stateService, storage = window.storageManager, samples = [], stages = [], restore = [];
    const wrap = (obj, name, label, keys=false) => { const old=obj[name]; obj[name]=async function(...args){const start=performance.now();try{return await old.apply(this,args);}finally{stages.push({stage:label,key:keys?args[0]:undefined,ms:performance.now()-start});}};restore.push(()=>obj[name]=old); };
    for(const name of ["_readDomains","_commit","_notifyCommitted"]) wrap(state,name,"state."+name);
    for(const name of ["read","writeWithoutLock","reconcileWithoutLock","finish"]) wrap(service.deps.store,name,"sync."+name);
    for(const f of new Set([storage.forage,service.deps.store.forage])) for(const name of ["getItem","setItem","removeItem"]) wrap(f,name,"idb."+name,true);
    let gaps=[], previous=performance.now();const timer=setInterval(()=>{const now=performance.now();gaps.push(now-previous);previous=now;},10);
    try {
      for(let round=0;round<sampleCount;round++) for(const [name,op] of [["favorite",()=>state.toggle("LIB-"+(round*3),"favorite")],["watched",()=>state.toggle("LIB-"+(round*3+1),"watched")],["offline-history",()=>state.appendOfflineHistory({carNum:"LIB-"+(round*3+2),providerId:"123",resource:"magnet:?xt=fixture",status:"submitted"})],["downloaded",()=>state.patch("LIB-"+(round*3+2),{downloaded:true})]]) {
        stages.length=0;gaps=[];previous=performance.now();const start=performance.now();await op();const elapsed=performance.now()-start;await new Promise(resolve=>setTimeout(resolve,20));samples.push({name,round,elapsed,maxTimerGap:Math.max(0,...gaps),stages:[...stages]});
      }
    } finally { clearInterval(timer);restore.reverse().forEach(fn=>fn()); }
    const journal = await storage.forage.getItem("mutation_journal");
    const record=await state.getState("LIB-2");const history=await state.getOfflineHistory();
    const carMap = await state.getCarMap();
    const allSamplesCommitted = Array.from({length:sampleCount},(_,round)=>round).every(round => carMap.get("LIB-"+(round*3))?.stateFlags.favorite && carMap.get("LIB-"+(round*3+1))?.stateFlags.watched && carMap.get("LIB-"+(round*3+2))?.stateFlags.downloaded && history.some(item=>item.carNum==="LIB-"+(round*3+2)));
    const discoveryRequests = window.__jhsBrowserDiagnostics.requests.filter(request => /\/actors\/|collection_actors|blacklist/.test(new URL(request.url).pathname)).map(request => new URL(request.url).pathname);
    return { samples, downloaded:record.stateFlags.downloaded, historySaved:history.some(r=>r.carNum==="LIB-2"), journalCleared:journal==null, allSamplesCommitted, discoveryRequests };
  }, { sync, sampleCount });
  await info.attach("performance-gate", { body: JSON.stringify(Object.fromEntries(["favorite", "watched", "offline-history", "downloaded"].flatMap(name => [[name + "CommitMs", measurements.samples.filter(sample => sample.name === name).map(sample => sample.elapsed)], [name + "TimerGapMs", measurements.samples.filter(sample => sample.name === name).map(sample => sample.maxTimerGap)]]))), contentType: "application/json" });
  console.log(JSON.stringify({count,sync,...measurements}));
  await info.attach("operation-persistence", {body:JSON.stringify({count,sync,...measurements},null,2),contentType:"application/json"});
  expect(measurements).toMatchObject({downloaded:true,historySaved:true,journalCleared:true,allSamplesCommitted:true,discoveryRequests:[]});
});
