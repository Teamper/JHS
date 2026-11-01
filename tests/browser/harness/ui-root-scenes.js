import {injectRealLayer} from "./real-layer.js";
import {fulfillHostFixtures,injectUserscriptRuntime} from "./runtime.js";
const image="https://images.example.test/ui-cover.svg";
export async function seed(page){
  await page.evaluate(async image=>{
    const forage=window.localforage.createInstance({driver:window.localforage.INDEXEDDB,name:"JAV-JHS",version:1,storeName:"appData"});
    await forage.setItem("data_version",3);
    await forage.setItem("snapshots",[{id:"ui-snapshot",name:"升级前的手动备份",source:"manual",time:"2026-10-03 16:00:00",itemCount:75,kind:"snapshot",data:{}}]);
    for(const name of ["Blacklist","FavoriteActress","NewVideo"]) { window.localStorage.setItem(`jhs_time_check${name}`,String(Date.parse("2026-10-04T06:00:00Z"))); window.localStorage.setItem(`jhs_time_check${name}_next`,String(Date.parse("2026-10-05T06:00:00Z"))); }
    await forage.setItem("car_list",Array.from({length:75},(_,i)=>({carNum:`UI-${100+i}`,url:`https://javdb.com/v/ui-${i}`,names:"演员名称与长别名测试",remark:i%2?"":"需要保留的影片备注",createDate:"2026-10-03 12:30:00",updateDate:"2026-10-04 12:30:00",publishTime:"2026-10-01",stateFlags:{downloaded:true,favorite:false,watched:false,blocked:false}})));
    await forage.setItem("favorite_actresses",[{starId:"ui-actor",name:"测试演员",allName:Array(12).fill("很长的演员别名"),actressType:"censored",avatar:image,lastCheckTime:"2026-10-04 16:22:31",lastPublishTime:"2026-10-06",newVideoList:Array.from({length:75},(_,i)=>({carNum:`NV-${100+i}`,title:"有内容的影片标题",publishTime:"2026-10-06",coverUrl:image}))}]);
    await forage.setItem("activity_log",{entries:Array.from({length:8},(_,i)=>({id:`ui-log-${i}`,type:"list-card-state",createdAt:"2026-10-04T12:00:00Z",commitState:"committed",changes:[{carNum:`UI-${i+100}`,undoState:"available"}]}))});
    await forage.setItem("offline_history",Array.from({length:8},(_,i)=>({id:`ui-offline-${i}`,providerId:"123",carNum:`UI-${i+100}`,createdAt:"2026-10-04T12:00:00Z",status:i===0?"failed":"submitted",errorMessage:i===0?"fixture media error":"",resource:`magnet:?xt=urn:btih:${"abcdef".repeat(30)}&dn=long-fixture-name`})));
  },image);
}
export async function boot(page,context,theme,options={}){
  await page.clock.setFixedTime(new Date("2026-10-04T08:00:00Z"));
  await fulfillHostFixtures(context); await context.route("https://images.example.test/**",route=>route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#63768c"/><text x="30" y="220" fill="white" font-size="44">JHS cover fixture</text></svg>'})); await page.goto(options.url || "https://javdb.com/");
  await injectUserscriptRuntime(page,{...options,hostStyles:true,realFeedback:true,beforeUserscriptInjection:async page=>{await injectRealLayer(page);await seed(page);},settingOverrides:{themeMode:theme,enableCheckBlacklist:"yes",enableCheckFavoriteActress:"yes",enableCheckNewVideo:"yes",enableLoadPreviewVideo:"no",enableLoadReview:"no",enableLoadOtherSite:"no",defaultQuickFilterTab:"all",magnetTagRules:JSON.stringify([{id:"ui-tag",name:"字幕优先",type:"contains",pattern:"中字",tag:"字幕",weight:20}]),magnetFilterRules:JSON.stringify([{id:"ui-filter",name:"排除低质量资源",type:"contains",pattern:"低清",action:"hide"}])}});
  await page.waitForFunction(()=>window.unsafeWindow.pluginManager.getBean("TaskPlugin")?.service);
}
