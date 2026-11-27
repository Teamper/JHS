import {afterEach, describe, expect, it, vi} from "vitest";
import {JSDOM} from "jsdom";
import jquery from "jquery";
import {OwnedPopover, ownedPopoverRoots} from "../src/core/owned-popover.js";
import {MediaPreviewSession} from "../src/core/media-preview-session.js";
import {taskStatusView, renderTaskStatus} from "../src/core/task-status-view.js";
import {JHS_Z_INDEX} from "../src/core/theme.js";

let dom, popover;
afterEach(()=>{popover?.close(); dom?.window.close(); vi.useRealTimers();});
describe("owned UI boundaries",()=>{
  it("closes when its anchor leaves the viewport and keeps a partially visible menu inside it",()=>{
    dom=new JSDOM('<button id="anchor">菜单</button><div id="menu"><button>动作</button></div>');
    Object.defineProperty(dom.window,'innerWidth',{value:844});Object.defineProperty(dom.window,'innerHeight',{value:390});
    const doc=dom.window.document,anchor=doc.querySelector('#anchor'),menu=doc.querySelector('#menu');
    let y=100;anchor.getBoundingClientRect=()=>({left:12,right:92,top:y,bottom:y+44,width:80,height:44});
    menu.getBoundingClientRect=()=>({height:100});Object.defineProperty(menu,'scrollHeight',{value:100});
    popover=new OwnedPopover(anchor,menu);popover.open();
    expect(Number(menu.style.zIndex)).toBeGreaterThan(JHS_Z_INDEX.hostTopbar);
    expect(Number(menu.style.zIndex)).toBeLessThan(JHS_Z_INDEX.modal);
    y=-20;popover.position();expect(parseFloat(menu.style.top)).toBeGreaterThanOrEqual(8);
    y=-100;popover.position();expect(popover.opened).toBe(false);expect(anchor.getAttribute('aria-expanded')).toBe('false');
  });
  it("isolates documents and releases portals when a category is hidden",async()=>{
    dom=new JSDOM('<section><button id="anchor">菜单</button><div id="menu"><button>动作</button></div></section>');
    const other=new JSDOM('<section><button>菜单</button><div><button>动作</button></div></section>');
    const doc=dom.window.document, anchor=doc.querySelector('#anchor'), menu=doc.querySelector('#menu');
    const second=new OwnedPopover(other.window.document.querySelector('section > button'),other.window.document.querySelector('section > div'));
    popover=new OwnedPopover(anchor,menu);popover.open();second.open();
    expect(popover.opened).toBe(true);expect(second.opened).toBe(true);
    anchor.parentElement.style.display='none';await new Promise(resolve=>setTimeout(resolve,0));
    expect(popover.opened).toBe(false);expect(doc.querySelector('.jhs-owned-popover')).toBeNull();
    expect(second.opened).toBe(true);second.close();other.window.close();
  });
  it("portals beyond clipping ancestors, wraps options, flips and closes Escape before its dialog",async()=>{
    dom=new JSDOM('<div class="layui-layer"><div style="overflow:hidden"><button id="anchor">菜单</button><div id="menu"><button>一</button><button>二</button></div></div></div>');
    const doc=dom.window.document, anchor=doc.querySelector('#anchor'), menu=doc.querySelector('#menu'), owner=doc.querySelector('.layui-layer');
    anchor.getBoundingClientRect=()=>({left:950,top:650,right:1010,bottom:690,width:60,height:40});
    Object.defineProperty(menu,'scrollHeight',{value:300});
    menu.getBoundingClientRect=()=>({height:300});
    popover=new OwnedPopover(anchor,menu); popover.open();
    expect(menu.parentNode).toBe(doc.body);
    expect(ownedPopoverRoots(owner)).toEqual([menu]);
    expect(menu.style.width).toBe('max-content'); expect(menu.style.minWidth).toBe('160px'); expect(menu.style.top).toBe('342px');
    const items=menu.querySelectorAll('button');
    items[0].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));
    expect(doc.activeElement).toBe(items[1]);
    const closeDialog=vi.fn(); doc.addEventListener('keydown',closeDialog);
    items[1].dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    expect(closeDialog).not.toHaveBeenCalled(); expect(doc.activeElement).toBe(anchor);
    expect(menu.parentNode).toBe(anchor.parentNode); expect(ownedPopoverRoots(owner)).toEqual([]);
    popover.open(); owner.remove(); await Promise.resolve();
    expect(popover.opened).toBe(false); expect(doc.querySelector('.jhs-owned-popover')).toBeNull();
  });
  it("canceling a media session settles readiness and ignores late media events",async()=>{
    dom=new JSDOM(''); const session=new MediaPreviewSession(), video=dom.window.document.createElement('video');
    const pending=session.waitReady(video,60000); session.dispose();
    await expect(pending).resolves.toBe(false);
    video.dispatchEvent(new dom.window.Event('canplay'));
    await expect(session.waitReady(video)).resolves.toBe(false);
  });
  it("uses committed enable flags and keeps zero, retry and running schedules distinct",()=>{
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
    expect(taskStatusView('newVideo',{ready:true,nextAt:0},{}).next).toBe('未计划');
    expect(taskStatusView('newVideo',{ready:true,nextAt:0,isPending:true},{})).toMatchObject({next:'待检查',nextLabel:'重试检查'});
    expect(taskStatusView('newVideo',{ready:true,state:'running'},{}).next).toBe('完成后更新');
    expect(taskStatusView('newVideo',{ready:true,state:'running'},{enableCheckNewVideo:'no'}).next).toBe('已停用');
    expect(taskStatusView('newVideo',{ready:false,nextAt:Date.now()+1000},{}).next).toBe('未计划');
    dom=new JSDOM(''); const root=renderTaskStatus(jquery(dom.window),'newVideo',{completedAt:Date.now(),nextAt:Date.now()+1000},{},true);
    expect(root.find('.jhs-task-times > div')).toHaveLength(2);
    expect(root.find('dt').map((_i,node)=>node.textContent).get()).toEqual(['上次完成','下次检查']);
  });
});
