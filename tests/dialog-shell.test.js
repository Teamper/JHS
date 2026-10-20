import { afterEach, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { prepareDialogOptions } from "../src/core/dialog-shell.js";
import { OwnedPopover } from "../src/core/owned-popover.js";
import jquery from "jquery";
import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
let dom;
afterEach(() => { dom?.window.close(); vi.unstubAllGlobals(); });
it("consumes UI metadata, preserves callbacks and releases resize listeners", () => {
    dom = new JSDOM('<div id="dialog"></div>');
    vi.stubGlobal("window", dom.window);
    const remove = vi.spyOn(dom.window, "removeEventListener"), success = vi.fn(() => "mounted"), end = vi.fn(() => "closed");
    const options = prepareDialogOptions({ ui: { size: "lg", body: "table" }, success, end, shadeClose: false }, { getDialogArea: () => ["800px", "600px"] });
    expect(options.ui).toBeUndefined();
    expect(Object.getOwnPropertySymbols(options)).toEqual([]);
    expect(options.shadeClose).toBe(false);
    expect(options.area).toEqual(["800px", "600px"]);
    expect(prepareDialogOptions(options)).toBe(options);
    const copied = { ...options };
    expect(prepareDialogOptions(copied)).toBe(copied);
    const root = dom.window.document.querySelector("#dialog");
    expect(options.success(root, 7)).toBe("mounted");
    expect(root.dataset.jhsDialogBody).toBe("table");
    Object.defineProperty(dom.window, "innerWidth", { value:390, configurable:true });
    dom.window.dispatchEvent(new dom.window.Event("resize"));
    expect(root.style.maxWidth).toBe("374px");
    expect(options.end("reason")).toBe("closed");
    expect(end).toHaveBeenCalledExactlyOnceWith("reason");
    expect(remove.mock.calls.some(([event]) => event === "resize")).toBe(true);
});

it("owns one iframe scroll lock across repeated success and ignores success after end", () => {
    dom = new JSDOM('<div id="dialog"></div>'); vi.stubGlobal("window",dom.window);
    const root=dom.window.document.querySelector('#dialog'), success=vi.fn();
    const options=prepareDialogOptions({type:2,scrollbar:false,success});
    options.success(root,1); options.success(root,1);
    expect(success).toHaveBeenCalledTimes(2);
    expect(dom.window.document.body.style.overflow).toBe('hidden');
    options.end();
    expect(dom.window.document.body.style.overflow).toBe('');
    options.success(root,1);
    expect(success).toHaveBeenCalledTimes(2);
    expect(dom.window.document.body.style.overflow).toBe('');
});

it("releases a removed iframe dialog even when the vendor end callback is absent", async () => {
    dom=new JSDOM('<div id="dialog"></div>'); vi.stubGlobal('window',dom.window);
    const root=dom.window.document.querySelector('#dialog'), options=prepareDialogOptions({type:2,scrollbar:false});
    options.success(root,1); expect(dom.window.document.body.style.overflow).toBe('hidden');
    root.remove(); await Promise.resolve();
    expect(dom.window.document.body.style.overflow).toBe('');
    options.end(); expect(dom.window.document.body.style.overflow).toBe('');
});

it("names the dialog, contains keyboard focus and restores its opener", async () => {
    dom = new JSDOM('<button id="opener">打开</button><div class="layui-layer" id="dialog"><div class="layui-layer-title">影片</div><button id="first">首项</button><button id="last">末项</button></div>');
    vi.stubGlobal("window", dom.window);
    const doc = dom.window.document, root = doc.querySelector('#dialog'), opener = doc.querySelector('#opener');
    opener.focus();
    const options = prepareDialogOptions({ type:1, ui:{body:'scroll'} });
    options.success(root, 1); await Promise.resolve();
    expect(root.getAttribute('role')).toBe('dialog');
    expect(root.getAttribute('aria-labelledby')).toBe(root.querySelector('.layui-layer-title').id);
    expect(doc.activeElement.id).toBe('first');
    const tab = shiftKey => doc.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Tab',shiftKey,bubbles:true,cancelable:true}));
    tab(true); expect(doc.activeElement.id).toBe('last');
    tab(false); expect(doc.activeElement.id).toBe('first');
    opener.focus(); expect(doc.activeElement.id).toBe('first');
    options.end(); expect(doc.activeElement).toBe(opener);
    opener.focus(); expect(doc.activeElement).toBe(opener);
});

it("leaves caller focus and iframe ownership intact and skips closed initial focus", async () => {
    dom = new JSDOM('<button id="opener">打开</button><div id="dialog"><button>内容</button></div>');
    vi.stubGlobal('window',dom.window);
    const doc=dom.window.document, root=doc.querySelector('#dialog'), opener=doc.querySelector('#opener');
    opener.focus();
    for (const config of [{type:1,ui:{focus:'caller'}},{type:2,ui:{body:'scroll'}}]) {
        const options=prepareDialogOptions(config);options.success(root,1);await Promise.resolve();
        expect(doc.activeElement).toBe(opener);options.end();
    }
    const options=prepareDialogOptions({type:1,ui:{body:'scroll'}});options.success(root,2);options.end();await Promise.resolve();
    expect(doc.activeElement).toBe(opener);
});

it("lets nested viewers and portal menus own focus without trapping the background",async()=>{
    dom=new JSDOM('<button id="opener">打开</button><div class="layui-layer" style="z-index:10" id="dialog"><button id="anchor">菜单</button><div id="menu"><button id="menuItem">动作</button></div></div>');
    vi.stubGlobal('window',dom.window);
    const doc=dom.window.document,root=doc.querySelector('#dialog'),opener=doc.querySelector('#opener');opener.focus();
    const options=prepareDialogOptions({type:1,ui:{body:'scroll'}});options.success(root,1);await Promise.resolve();
    const popover=new OwnedPopover(doc.querySelector('#anchor'),doc.querySelector('#menu'));popover.open();
    expect(doc.activeElement.id).toBe('menuItem');popover.close(true);
    const viewer=doc.createElement('div');viewer.className='viewer-container';viewer.innerHTML='<button id="viewerAction">图片</button>';doc.body.append(viewer);
    viewer.querySelector('button').focus();expect(doc.activeElement.id).toBe('viewerAction');
    viewer.remove();doc.querySelector('#anchor').focus();expect(doc.activeElement.id).toBe('anchor');
    options.end();expect(doc.activeElement).toBe(opener);
});

it("restores nested Layer focus after native removal and still respects later higher layers", async () => {
    dom = new JSDOM('<button id="opener">打开</button><script src="https://example.test/layer.js"></script>', { runScripts: "outside-only" });
    const { window } = dom, doc = window.document;
    window.jQuery = jquery(window);
    window.eval(readTestFile(join(import.meta.dirname, "browser/fixtures/layer-runtime/layer-1.0.9.min.js"), "utf8"));
    vi.stubGlobal("window", window);
    const computed = window.getComputedStyle.bind(window);
    // Chromium returns no computed z-index after Layer removes its DOM, unlike jsdom.
    vi.spyOn(window, "getComputedStyle").mockImplementation(node => !node.isConnected
        ? new Proxy(computed(node), { get: (style, key) => key === "zIndex" ? "" : Reflect.get(style, key) })
        : computed(node));
    const open = (label, zIndex) => window.layer.open(prepareDialogOptions({ type: 1, title: label, content: `<button id="${label}">${label}</button>`, zIndex, anim: -1, ui: {} }));
    const close = async id => { window.layer.close(id); await new Promise(resolve => window.setTimeout(resolve, 0)); };
    doc.querySelector("#opener").focus();
    const parent = open("parent", 100); await Promise.resolve();
    const child = open("child", 200); await Promise.resolve();
    doc.querySelector(`#layui-layer${child}`).style.zIndex = "300";
    await close(child);
    expect(doc.activeElement.id).toBe("parent");
    const lower = open("lower", 200); await Promise.resolve();
    const higher = doc.createElement("div"); higher.className = "layui-layer"; higher.style.zIndex = "400";
    higher.innerHTML = '<button id="higher">higher</button>'; doc.body.append(higher); higher.firstChild.focus();
    await close(lower);
    expect(doc.activeElement.id).toBe("higher");
    higher.remove(); doc.querySelector("#parent").focus();
    await close(parent);
    expect(doc.activeElement.id).toBe("opener");
});
