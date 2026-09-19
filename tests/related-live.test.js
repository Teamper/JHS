// @vitest-environment jsdom
import { it, expect, vi } from "vitest";
import jquery from "jquery";
import { RelatedPanel } from "../src/ui/detail/related-panel.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

it("owned related panels dispose requests and subscriptions independently", async () => {
    vi.stubGlobal("$",jquery);
    const settings=new EventTarget(), values={enableLoadRelated:"no"}, requests=[], cleanups=[];
    settings.snapshot=()=>values;
    settings.set=async(key,value)=>{values[key]=value;settings.dispatchEvent(new CustomEvent("settings.changed",{detail:{names:[key]}}));};
    const remove=vi.spyOn(settings,"removeEventListener"), parent=new LifecycleScope("related-owner");
    const service={list:(_ref,{scope})=>new Promise(resolve=>requests.push({scope,resolve}))};
    const owner=new RelatedPanel({settings,related:service,scope:async()=>parent});
    document.body.innerHTML='<div id="a"></div><div id="b"></div>';
    try {
        const a=await owner.show(jquery("#a"),"A",{ownCleanup:fn=>cleanups.push(fn)});
        const b=await owner.show(jquery("#b"),"B",{ownCleanup:fn=>cleanups.push(fn)});
        a.find("button").trigger("click");
        expect(requests).toHaveLength(2);
        cleanups[0]();a.remove();
        expect(requests[0].scope.disposed).toBe(true);
        expect(requests[1].scope.disposed).toBe(false);
        requests[0].resolve([{id:"stale",name:"stale"}]);requests[1].resolve([]);
        await vi.waitFor(()=>expect(b.text()).toContain("无清单"));
        cleanups[1]();
        expect(remove).toHaveBeenCalledTimes(2);
        expect(parent.cleanups.size).toBe(0);
        await settings.set("enableLoadRelated","no");await settings.set("enableLoadRelated","yes");
        expect(requests).toHaveLength(2);
    } finally {parent.dispose();document.body.replaceChildren();vi.unstubAllGlobals();}
});
