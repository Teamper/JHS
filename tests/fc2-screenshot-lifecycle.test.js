// @vitest-environment jsdom
import jquery from "jquery";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsService } from "../src/services/settings-service.js";
import { ScreenshotService } from "../src/services/screenshot-service.js";
import { HttpService } from "../src/services/http-service.js";
import { ExternalUrlPolicy } from "../src/services/external-url-policy.js";
import { CacheService } from "../src/services/cache-service.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { createIntegrationRequestFacade } from "../src/app/integration-registry.js";
import manifest, { createJavStoreAdapter } from "../src/integrations/javstore/manifest.js";
import { Fc2WorkspaceService } from "../src/features/detail/fc2-workspace-service.js";
import { createFc2DetailContext } from "../src/ui/detail/fc2-detail-workspace.js";

const cleanups = [];
afterEach(() => { cleanups.splice(0).reverse().forEach(fn => fn()); document.body.innerHTML=""; vi.unstubAllGlobals(); });
async function fixture(mode, request) {
    vi.stubGlobal("$", jquery); vi.stubGlobal("clog", {error:vi.fn()});
    let stored = {enableLoadScreenShot:"yes", screenshotMode:mode};
    const settings = new SettingsService({get:async()=>stored, set:async(_key,value)=>{stored=value;}});
    await settings.load();
    const http = new HttpService({request}, new ExternalUrlPolicy(), {cache:new CacheService()});
    const adapter = createJavStoreAdapter(createIntegrationRequestFacade(http, manifest));
    const screenshot = new ScreenshotService({get:()=>null, getAvailable:async()=>[]}, {list:()=>[manifest], getAdapter:()=>adapter});
    const scope = new LifecycleScope("feature-test"); cleanups.push(()=>scope.dispose());
    const service = new Fc2WorkspaceService({runtimeServices:{settings,screenshot,scope:()=>scope,logger:{error:vi.fn()}}});
    const root = jquery('<main class="jhs-fc2-workspace"><div data-jhs-role="screenshot"></div></main>').appendTo(document.body);
    const context = createFc2DetailContext(root,{carNum:"FC2-1234567"}); cleanups.push(()=>context.destroy());
    service.bindFc2FeatureLifecycle(context); service.loadFc2Screenshot(context);
    return {root,context,settings,scope,service};
}

it("applies provider and mode settings to an already-open FC2 screenshot panel", async () => {
    const request = vi.fn(async options=>({status:200,data:'<main>No results</main>',finalUrl:options.url}));
    const {root,settings}=await fixture("manual", request);
    await vi.waitFor(()=>expect(root.find('[role="tab"]')).toHaveLength(1));
    const old = root.find('[role="tab"]');
    await settings.set("screenshotProviders", [{id:"javstore",enabled:false}]);
    await vi.waitFor(()=>expect(root.find('[role="tab"]')).toHaveLength(0));
    old.trigger("click"); expect(request).not.toHaveBeenCalled();
    await settings.patch({screenshotProviders:[],screenshotMode:"auto"});
    await vi.waitFor(()=>expect(root.text()).toContain("暂无缩略图"));
    expect(request).toHaveBeenCalledOnce();
});

it.each(["close","disable","replace"])("cancels only the FC2 screenshot consumer on %s", async action => {
    let release;
    const request=vi.fn(options=>new Promise((resolve,reject)=>{
        release=()=>resolve({status:200,data:'<a href="/FC2-1234567-pn.html">FC2-1234567</a>',finalUrl:options.url});
        options.signal.addEventListener("abort",()=>reject(new DOMException("cancelled","AbortError")),{once:true});
    }));
    const {context,settings,scope,root}=await fixture("auto",request);
    await vi.waitFor(()=>expect(request).toHaveBeenCalledOnce());
    if(action==="close") context.destroy();
    else if(action==="disable") await settings.set("enableLoadScreenShot","no");
    else await settings.set("screenshotMode","manual");
    await vi.waitFor(()=>expect(request.mock.calls[0][0].signal.aborted).toBe(true));
    expect(scope.disposed).toBe(false);
    release(); await new Promise(resolve=>setTimeout(resolve,0));
    expect(request).toHaveBeenCalledOnce(); expect(root.find("img")).toHaveLength(0);
});
