import { test, expect } from "@playwright/test";
import { fulfillHostFixtures, injectUserscriptRuntime } from "../harness/runtime.js";
test.use({trace:"off",screenshot:"off"});
test("computation slices allow timers and painting to run before completion", async ({ page, context }, info) => {
  test.skip(info.project.name!=="desktop-wide","fixed scheduling environment");
  await fulfillHostFixtures(context);await page.goto("https://javdb.com/");await injectUserscriptRuntime(page);
  const results=await page.evaluate(async()=>{
    const budget=window.stateService.computation,original=budget.yieldTask,results=[];
    const channel=()=>new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=()=>{c.port1.close();c.port2.close();resolve()};c.port2.postMessage(null)});
    try{for(const strategy of ["default","channel","paint"]){
      budget.yieldTask=strategy==="default"?original:strategy==="channel"?channel:()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
      let ticks=0,frames=0,done=false;const timer=setInterval(()=>ticks++,10);const frame=()=>{if(!done){frames++;requestAnimationFrame(frame)}};requestAnimationFrame(frame);
      function* steps(){let sum=0;for(let i=0;i<10000;i++){const end=performance.now()+.02;while(performance.now()<end){}sum+=i;yield;}return sum;}
      const start=performance.now();const value=await budget.run("fairness.fixture",steps());done=true;clearInterval(timer);results.push({strategy,value,ticks,frames,elapsed:performance.now()-start});
    }}finally{budget.yieldTask=original;}return results;
  });
  console.log(JSON.stringify({fairness:results}));await info.attach("fairness",{body:JSON.stringify(results),contentType:"application/json"});
  expect(results[0].value).toBe(49995000);expect(results[0].ticks).toBeGreaterThan(0);expect(results[0].frames).toBeGreaterThan(0);
});
