import { openDetailEnhancements, enterMovieSelection, openUtility } from "../harness/enhancement-navigation.js";
import {expect,test} from "@playwright/test";
import {readFile,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {assertNoHorizontalOverflow,fulfillHostFixtures,injectUserscriptRuntime} from "../harness/runtime.js";
import {installSharedGmFixture} from "../harness/shared-gm.js";
import {clickSettingsCategory} from "../harness/settings-navigation.js";

async function boot(page,context,theme,mode="detail",sharedGm=null) {
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await fulfillHostFixtures(context);
  if(mode==="detail") {
    const html=await readFile(new URL("../fixtures/javdb-detail-interactions.html",import.meta.url),"utf8");
    await context.route("https://javdb.com/v/**",route=>route.fulfill({contentType:"text/html",body:html}));
  }
  const url=mode==="fc2"?"https://javdb.com/users/collection_codes?movieId=fixture-id&carNum=FC2-1234567&url=https%3A%2F%2Fjavdb.com%2Fv%2Ffixture-id&source=fc2":mode==="list"?"https://javdb.com/":mode==="javbus"?"https://www.javbus.com/ABC-123":"https://javdb.com/v/test-id";
  await page.goto(url);
  await injectUserscriptRuntime(page,{
    hostStyles:true,realFeedback:true,
    settingOverrides:{themeMode:theme,defaultQuickFilterTab:"all",translateTitle:"no",enableLoadPreviewVideo:"no",enableLoadScreenShot:"no",enableLoadReview:"no",enableLoadOtherSite:"no",enableLoadRelatedList:"no"},
    beforeUserscriptInjection:async host=>{
      if(sharedGm)await sharedGm.attach(host);
      await host.addScriptTag({path:fileURLToPath(new URL("../fixtures/layer-runtime/layer-1.0.9.min.js",import.meta.url))});
      await host.evaluate(()=>{
        window.translationCalls=[];window.translationFailPrimary=false;window.translationAborts=0;
        const previous=window.GM_xmlhttpRequest;
        window.GM_xmlhttpRequest=options=>{
          const url=new URL(options.url),isTranslation=url.hostname.endsWith(".translation.example");
          const isMovie=/\/api\/v4\/movies\/fixture-id$/.test(url.pathname),isMagnets=/\/api\/v1\/movies\/fixture-id\/magnets$/.test(url.pathname);
          if(!isTranslation&&!isMovie&&!isMagnets)return previous(options);
          if(isTranslation)window.translationCalls.push({url:url.href,headers:options.headers,body:JSON.parse(options.data)});
          let cancelled=false;
          setTimeout(()=>{
            if(cancelled)return;
            const failed=isTranslation&&window.translationFailPrimary&&url.hostname.startsWith("primary.");
            const data=isMovie?{success:1,data:{movie:{id:"fixture-id",number:"FC2-PPV-1234567",title:"FC2 本地标题",origin_title:"FC2-PPV-1234567 日本語の原題",preview_images:[],actors:[]}}}:isMagnets?{success:1,data:{magnets:[]}}:failed?{error:{code:"rate_limit_exceeded"}}:{choices:[{message:{role:"assistant",content:"服务译文 ABC-123"},finish_reason:"stop"}],usage:{prompt_tokens:12,completion_tokens:8,total_tokens:20}};
            options.onload({status:failed?429:200,response:data,responseText:JSON.stringify(data),finalUrl:url.href,responseHeaders:"content-type: application/json"});
          }, window.translationDelay || 0);
          return{abort(){cancelled=true;if(isTranslation)window.translationAborts++;options.onabort?.();}};
        };
      });
    },
  });
  return errors;
}

test("obsolete budget records never block translation",async({page,context},info)=>{
 test.skip(info.project.name!=="desktop-wide","one project owns the legacy budget scenario");
 await boot(page,context,"light");await seed(page);
 await page.evaluate(async()=>{const store=window.localforage.createInstance({name:"JAV-JHS",storeName:"appData"});await store.setItem("jhs_translation_budget_v1",{corrupt:true});});
 await openDetailEnhancements(page);await page.locator(".jhs-translation-entry").click();
 const workspace=page.locator(".jhs-translation-workspace");await workspace.getByRole("button",{name:"翻译所列标题",exact:true}).click();
 await expect(workspace.locator(".jhs-translation-output").last()).toHaveText("服务译文 ABC-123");
 expect(await page.evaluate(()=>window.translationCalls.length)).toBe(1);
 await workspace.getByRole("button",{name:"翻译设置",exact:true}).click();await expect(page.locator(".jhs-translation-settings")).not.toContainText("预算");
});

test("full settings opens the registered translation configuration command",async({page,context},info)=>{
  test.skip(info.project.name!=="desktop-wide","one project owns the stable full settings entry");await boot(page,context,"light","list");
  await page.evaluate(()=>window.unsafeWindow.pluginManager.getBean("SettingPlugin").openSettingDialog());
  await expect(page.locator("#saveBtn")).toHaveAttribute("data-jhs-settings-ready","true");
  await clickSettingsCategory(page.locator('.side-menu-item[data-panel="resources-panel"]'));
  await page.locator('[data-jhs-open="translation"]').click();await expect(page.locator(".jhs-translation-settings")).toBeVisible();
});

async function seed(page) {
  await page.evaluate(async()=>{
    await window.credentialService.set("jhs_translation_connections_v1",JSON.stringify({schema:1,profiles:[{id:"primary",name:"配置服务",type:"custom-chat",endpoint:"https://primary.translation.example/v1/chat?token=fixture-address-secret",model:"configured-model",apiKey:"fixture-api-secret",enabled:true}],primary:"primary",fallbacks:[]}));
  });
}
async function pick(control,value) {
 const text=await control.locator("..").locator("select").evaluate((select,value)=>[...select.options].find(option=>option.value===value||option.text===value).text,value);
 await control.click();await control.page().getByRole("option",{name:text,exact:true}).click();
}
async function addProfile(panel,name,host) {
  await panel.getByRole("button",{name:"添加服务",exact:true}).click();
  const row=panel.getByRole("group",{name:"具名服务配置",exact:true}).locator("fieldset").last();
  await row.getByLabel("名称",{exact:true}).fill(name);
  await pick(row.getByRole("combobox",{name:"协议",exact:true}),"custom-chat");
  await row.getByLabel("模型",{exact:true}).fill("configured-model");
  await row.getByLabel("接口地址",{exact:true}).fill(`https://${host}.translation.example/v1/chat?token=fixture-address-secret`);
  await row.getByLabel("API Key",{exact:true}).fill("fixture-api-secret");
  await row.getByRole("switch",{name:"启用",exact:true}).check();
  return panel.getByRole("group",{name,exact:true,includeHidden:true});
}
async function utility(page,name) { return openUtility(page,name); }

for(const theme of ["light","dark"]) {
  test(`translation connections, explicit fallback and cached manual results ${theme}`,async({page,context},info)=>{
    const errors=await boot(page,context,theme);
    const entry=page.locator(".jhs-translation-entry");await expect(entry).toHaveCount(1);await openDetailEnhancements(page);await entry.click();
    const workspace=page.locator(".jhs-translation-workspace");await expect(workspace).toContainText("ABC-123");
    await expect(workspace.locator(".jhs-translation-row > strong")).toHaveCSS("color",theme==="dark"?"rgb(230, 235, 241)":"rgb(31, 39, 51)");
    await workspace.getByRole("button",{name:"翻译设置",exact:true}).click();
    const panel=page.locator(".jhs-translation-settings");
    const primary=await addProfile(panel,"主服务","primary");
    await primary.getByRole("button",{name:"测试连接",exact:true}).click();await expect(primary).toContainText("连接成功");
    await addProfile(panel,"备用服务","secondary");
    await pick(panel.getByRole("combobox",{name:"主服务",exact:true}),"主服务");
    await panel.getByRole("button",{name:"添加备用服务",exact:true}).click();
    await pick(panel.getByRole("combobox",{name:"备用服务",exact:true}),"备用服务");
    const save=panel.getByRole("button",{name:"保存服务",exact:true});await save.click();await expect(panel).toContainText("服务配置已保存");await expect(save).toBeFocused();
    const encrypted=await page.evaluate(()=>window.GM_getValue("jhs_translation_connections_v1"));
    expect(encrypted).toMatchObject({schema:2});expect(JSON.stringify(encrypted)).not.toContain("fixture-api-secret");expect(JSON.stringify(encrypted)).not.toContain("fixture-address-secret");
    if (!await primary.locator("..").evaluate(node=>node.open)) await primary.locator("..").locator(":scope > summary").click();
    await primary.getByLabel("名称",{exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath(`translation-connections-${theme}.png`)});
    if(process.env.JHS_VISUAL_REGRESSION==="1")await expect(page).toHaveScreenshot(`translation-connections-${theme}.png`,{maxDiffPixelRatio:.02});
    await page.keyboard.press("Escape");await expect(panel).toHaveCount(0);
    await page.evaluate(()=>{window.translationFailPrimary=true;});
    await workspace.getByRole("button",{name:"翻译所列标题",exact:true}).click();
    await expect(workspace.locator(".jhs-translation-row .jhs-translation-output").last()).toHaveText("服务译文 ABC-123");
    await expect(workspace.locator(".jhs-translation-output").last()).toContainText("服务译文");await expect(workspace.locator(".jhs-translation-meta")).toHaveText("");await expect(workspace.locator(".jhs-translation-output").last()).toContainText("服务译文");await expect(workspace.locator(".jhs-translation-meta")).toHaveText("");
    await expect(workspace.getByRole("button",{name:"翻译所列标题",exact:true})).toBeFocused();
    expect(await page.evaluate(()=>window.translationCalls.length)).toBe(3);
    await workspace.getByRole("button",{name:"翻译所列标题",exact:true}).click();await expect(workspace.locator(".jhs-translation-output").last()).toContainText("服务译文");await expect(workspace.locator(".jhs-translation-meta")).toHaveText("");
    expect(await page.evaluate(()=>window.translationCalls.length)).toBe(3);
    await expect(workspace.getByRole("button",{name:"翻译所列标题",exact:true})).toBeEnabled();
    await expect(workspace.getByRole("button",{name:"翻译所列标题",exact:true})).toBeFocused();
    await workspace.evaluate(root => { root.closest(".layui-layer-content").scrollTop = 0; });
    await expect.poll(() => workspace.evaluate(root => root.closest(".layui-layer-content").scrollTop)).toBe(0);
    await writeFile(info.outputPath("translation-geometry.json"),JSON.stringify(await page.evaluate(()=>({innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll("body *")].filter(node=>node.getBoundingClientRect().right>document.documentElement.clientWidth+1).slice(0,25).map(node=>({tag:node.tagName,id:node.id,className:typeof node.className==="string"?node.className:"",right:node.getBoundingClientRect().right,width:getComputedStyle(node).width,position:getComputedStyle(node).position})),elements:[...document.querySelectorAll("html,body,main,.layui-layer,.jhs-translation-workspace,.jhs-translation-row")].map(node=>{const style=getComputedStyle(node);return {tag:node.tagName,id:node.id,className:node.className,rect:node.getBoundingClientRect().toJSON(),width:style.width,padding:style.padding,boxSizing:style.boxSizing,position:style.position,transform:style.transform};})})),null,2));
    await assertNoHorizontalOverflow(page);
    await page.screenshot({path:info.outputPath(`translation-manual-${theme}.png`)});
    if(process.env.JHS_VISUAL_REGRESSION==="1")await expect(page).toHaveScreenshot(`translation-manual-${theme}.png`,{maxDiffPixelRatio:.02});
    const requests=await page.evaluate(()=>window.translationCalls);
    expect(requests.every(request=>request.body.model==="configured-model"&&request.body.stream===false&&request.headers.Authorization==="Bearer fixture-api-secret")).toBe(true);
    await page.keyboard.press("Escape");await expect(workspace).toHaveCount(0);await expect(entry).toBeFocused();expect(errors).toEqual([]);
  });

  test(`selected list translation preserves masked titles and suspends automatic requests ${theme}`,async({page,context})=>{
    const errors=await boot(page,context,theme,"list");await seed(page);
    await enterMovieSelection(page);
    await page.getByRole("checkbox",{name:"选择 ABC-123",exact:true}).check();
    const batch=page.getByRole("button",{name:"批量翻译",exact:true});await batch.click();
    const workspace=page.locator(".jhs-translation-workspace");await workspace.getByRole("button",{name:"翻译所列标题",exact:true}).click();
    await expect(workspace.locator(".jhs-translation-output").last()).toContainText("服务译文");await expect(workspace.locator(".jhs-translation-meta")).toHaveText("");expect(await page.evaluate(()=>window.translationCalls.length)).toBe(1);
    await page.keyboard.press("Escape");await expect(workspace).toHaveCount(0);
    await(await utility(page,"隐私遮罩")).click();await expect(page.locator("html")).toHaveAttribute("data-jhs-privacy-active","");
    await batch.click();await expect(workspace).toHaveAttribute("data-jhs-translation-masked","");
    await workspace.getByRole("button",{name:"翻译所列标题",exact:true}).click();await expect(workspace.locator(".jhs-translation-output").last()).toContainText("服务译文");await expect(workspace.locator(".jhs-translation-meta")).toHaveText("");
    await expect(workspace.locator(".jhs-translation-output").last()).toHaveCSS("color","rgba(0, 0, 0, 0)");
    await page.evaluate(()=>window.settingsService.set("translateTitle","yes"));
    await page.waitForTimeout(100);expect(await page.evaluate(()=>window.translationCalls.length)).toBe(1);
    await page.keyboard.press("Escape");await(await utility(page,"关闭隐私遮罩")).click();
    await page.locator(".movie-list .video-title").scrollIntoViewIfNeeded();
    await expect(page.locator(".movie-list .video-title")).toContainText("服务译文 ABC-123");expect(await page.evaluate(()=>window.translationCalls.length)).toBe(2);expect(errors).toEqual([]);
  });

  test(`FC2 workspace translates its original title through the shared panel ${theme}`,async({page,context})=>{
    const errors=await boot(page,context,theme,"fc2");await seed(page);
    await expect(page.locator(".jhs-fc2-original-title")).toContainText("日本語の原題");
    await expect(page.locator(".jhs-fc2-meta").first()).toContainText("时长：未知");
    const headingColor = await page.locator(".jhs-fc2-title").evaluate(node => getComputedStyle(node).color);
    await expect(page.locator(".jhs-fc2-title strong")).toHaveCSS("color",headingColor);
    await expect(page.locator(".jhs-fc2-actors > strong")).toHaveCSS("color",headingColor);
    const entry=page.locator(".jhs-fc2-workspace .jhs-translation-entry");await expect(entry).toHaveCount(1);await openDetailEnhancements(page);await entry.click();
    const workspace=page.locator(".jhs-translation-workspace");await expect(workspace).toContainText("日本語の原題");
    await workspace.getByRole("button",{name:"翻译所列标题",exact:true}).click();await expect(workspace.locator(".jhs-translation-output").last()).toContainText("服务译文");await expect(workspace.locator(".jhs-translation-meta")).toHaveText("");
    expect(await page.evaluate(()=>window.translationCalls[0].body.messages[1].content)).toContain("FC2-PPV-1234567 日本語の原題");
    await page.keyboard.press("Escape");await expect(entry).toBeFocused();expect(errors).toEqual([]);
  });
}


test("closing manual translation cancels its request while automatic translation remains usable", async ({page, context}) => {
  await boot(page,context,"light","list");
  await seed(page);
  await page.evaluate(()=>{window.translationDelay=500;});
  await enterMovieSelection(page);
  await page.getByRole("checkbox",{name:"选择 ABC-123",exact:true}).check();
  await page.getByRole("button",{name:"批量翻译",exact:true}).click();
  await page.locator(".jhs-translation-workspace").getByRole("button",{name:"翻译所列标题",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.translationCalls.length)).toBe(1);
  await page.evaluate(()=>window.settingsService.set("disabledPlugins", '["translation-tools"]'));
  await expect(page.locator(".jhs-translation-workspace")).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>window.translationAborts)).toBe(1);
  await page.evaluate(()=>window.settingsService.set("translateTitle","yes"));
  await expect(page.locator(".movie-list .video-title")).toContainText("服务译文 ABC-123");
  expect(await page.evaluate(()=>window.translationCalls.length)).toBe(2);
});
