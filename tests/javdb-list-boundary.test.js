import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import jquery from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";
import { ListSortController } from "../src/features/list/list-sort-controller.js";
import { AutoPageController } from "../src/features/list/auto-page-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { scanAllPages } from "../src/features/list/batch-scanner.js";
afterEach(() => vi.unstubAllGlobals());
const html = readFileSync(new URL("./browser/fixtures/javdb-home-multiple-lists.html", import.meta.url), "utf8");
function setup(markup = html) { const dom = new JSDOM(markup, {url:"https://javdb.com/"}); vi.stubGlobal("window",dom.window); const host = new JavDbHostAdapter(dom.window.document,dom.window.location); return {dom,host,doc:dom.window.document}; }
describe("JavDB primary list boundary", () => {
 it.each(["rateCount","date","default"])("sorts only results and retains non-card nodes: %s", async method => {
  const {dom,host,doc}=setup(); const weekly=doc.querySelector("#weekly").outerHTML;
  const root=host.locateListRoot(), cards=[...root.children]; const sentinel=doc.createElement("span"); root.insertBefore(sentinel,cards[1]);
  const controller=new ListSortController({hostAdapter:host,settings:{snapshot:()=>({autoPage:"no",sortMethod:method})}});
  await controller.sortItems();
  expect(doc.querySelector("#weekly").outerHTML).toBe(weekly); expect(root.children).toHaveLength(3); expect(root.children[1]).toBe(sentinel);
  expect([...root.querySelectorAll(":scope > .item")]).toEqual(method==="default"?cards:[cards[1],cards[0]]); dom.window.close();
 });
 it("keeps ties stable and restores native order after a date sort",async()=>{
  const {dom,host,doc}=setup();const root=host.locateListRoot(), cards=[...root.children];root.querySelectorAll(".score").forEach(e=>{e.textContent="由5人评价";});
  const sort=new ListSortController({hostAdapter:host,settings:{snapshot:()=>({autoPage:"no"})}});
  await sort.sortItems("rateCount");expect([...root.children]).toEqual(cards);
  await sort.sortItems("date");expect([...root.children]).toEqual([...cards].reverse());
  await sort.sortItems("default");expect([...root.children]).toEqual(cards);expect(doc.querySelector("#weekly").children).toHaveLength(1);dom.window.close();
 });
 it("keeps the one-plus-one regression in separate lists",async()=>{const {dom,host,doc}=setup();doc.querySelector("#results > .item:last-child").remove(); doc.querySelector("#results .score").textContent="由100人评价"; await new ListSortController({hostAdapter:host,settings:{snapshot:()=>({autoPage:"no",sortMethod:"rateCount"})}}).sortItems(); expect(doc.querySelector("#weekly").children).toHaveLength(1);expect(doc.querySelector("#results").children).toHaveLength(1);dom.window.close();});
 it("retains empty results and ignores nested or late recommendations",()=>{const {dom,host,doc}=setup();doc.querySelector("#results").replaceChildren();const wrapper=doc.createElement("aside"); doc.querySelector("#weekly").replaceWith(wrapper); wrapper.append(dom.window.document.createElement("h3"),new dom.window.DOMParser().parseFromString(html,"text/html").querySelector("#weekly"));expect(host.locateListRoot().id).toBe("results");expect(host.locateListItems()).toHaveLength(0);doc.querySelector(".container").prepend(wrapper.cloneNode(true));expect(host.locateListRoot().id).toBe("results");dom.window.close();});
 it("rejects ambiguity without marking either list; accepts a unique empty list",()=>{const {dom,host,doc}=setup('<div class="movie-list"></div><div class="movie-list"></div>');expect(host.locateListRoot()).toBeNull();expect(doc.querySelector('[data-jhs-primary-list]')).toBeNull();doc.body.lastChild.remove();expect(host.locateListRoot()).not.toBeNull();dom.window.close();});
 it("resolves unmarked fetched pages and scopes the batch scanner",async()=>{const {dom,host,doc}=setup();const $=jquery(dom.window);globalThis.$=$;globalThis.DOMParser=dom.window.DOMParser;try{const records=await scanAllPages({startDom:$(doc),resolvePage:page=>{const boundary=host.resolveListBoundary(page[0]);return {items:[...boundary.root.children],nextUrl:null};},fetchHtml:()=>{throw Error("unexpected request");},parseItem:item=>({carNum:item.find("strong").text()}),evaluate:()=>({matchesCurrentFilter:true}),pageDelayMs:0});expect(records.map(r=>r.carNum)).toEqual(["ABC-001","ABC-002"]);expect(host.resolveListBoundary(doc).root.id).toBe("results");}finally{delete globalThis.$;delete globalThis.DOMParser;dom.window.close();}});
 it("does not rewrite ownership attributes while reading a stable list",()=>{
  const {dom,host}=setup();const root=host.locateListRoot();const observer=new dom.window.MutationObserver(()=>{});observer.observe(root,{attributes:true});
  for(let i=0;i<10;i++)host.getLiveListSelectors();expect(observer.takeRecords()).toHaveLength(0);observer.disconnect();dom.window.close();
 });
 it("releases stale markers and honors explicitly owned roots",()=>{const {dom,host,doc}=setup();const old=host.locateListRoot();const next=host.createOwnedListRoot();old.replaceWith(next);expect(host.locateListRoot()).toBe(next);expect(doc.querySelectorAll('[data-jhs-primary-list]')).toHaveLength(1);dom.window.close();});
});

describe("dual-list remote paging", () => {
 it("associates the unique external pagination only on single-list pages",()=>{
  const {dom,host,doc}=setup('<main><div class="movie-list"></div></main><ul class="pagination-list"><li><a class="pagination-link is-current">1</a></li></ul><a class="pagination-next" href="?page=2">Next</a>');
  const boundary=host.resolveListBoundary();expect(boundary.pagination).toBe(doc.querySelector(".pagination-list"));expect(boundary.nextLink.getAttribute("href")).toBe("?page=2");dom.window.close();
 });
 it("appends only fetched results and leaves the recommendation nodes intact", async () => {
  const {dom,host,doc}=setup(); const scope=new LifecycleScope("boundary-paging"); const $=jquery(dom.window);
  dom.window.isListPage=true;
  const settings=new dom.window.EventTarget(); settings.snapshot=()=>({autoPage:"yes"});
  const response=html.replaceAll("ABC-001","DEF-003").replaceAll("ABC-002","DEF-004").replace('?page=2','?page=3');
  const controller=new AutoPageController({hostAdapter:host,http:{request:async()=>({data:response})},settings,scope,window:dom.window,document:doc,ui:{jquery:$},list:{replaceCoverImages(){}}});
  controller.preloadDistance=-100000;
  const weekly=doc.querySelector("#weekly"), before=weekly.outerHTML;
  try { await controller.mount(); await controller.loadNextPage(); expect(doc.querySelectorAll("#results > .item")).toHaveLength(4); expect(weekly.outerHTML).toBe(before); expect(controller.nextUrl).toBe("https://javdb.com/?page=3"); }
  finally {scope.dispose();dom.window.close();}
 });
 it("rejects a late response after the result root was replaced", async () => {
  const {dom,host,doc}=setup(); const scope=new LifecycleScope("boundary-late"); const $=jquery(dom.window);
  dom.window.isListPage=true;
  const settings=new dom.window.EventTarget(); settings.snapshot=()=>({autoPage:"yes"});
  let finish; const response=new Promise(resolve=>{finish=resolve;});
  const controller=new AutoPageController({hostAdapter:host,http:{request:()=>response},settings,scope,window:dom.window,document:doc,ui:{jquery:$},list:{replaceCoverImages(){}}});
  controller.preloadDistance=-100000;
  try {await controller.mount();const pending=controller.loadNextPage();await new Promise(resolve=>setTimeout(resolve,0));const old=doc.querySelector("#results"), next=old.cloneNode(true);old.replaceWith(next);finish({data:html});await pending;expect(next.children).toHaveLength(2);expect(old.children).toHaveLength(2);expect(doc.querySelector("#weekly").children).toHaveLength(1);}
  finally {scope.dispose();dom.window.close();}
 });
});
