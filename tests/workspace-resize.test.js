import {it, expect, vi} from "vitest";
import {JSDOM} from "jsdom";
import {Utils} from "../src/core/utils.js";
it("resizes an open workspace and releases the resize listener on close",()=>{
 const dom=new JSDOM('<div id="layui-layer7"><div class="layui-layer-title">Detail</div><div class="layui-layer-content"><iframe></iframe></div></div>',{url:'https://javdb.com'});
 vi.stubGlobal('window',dom.window); vi.stubGlobal('HTMLElement',dom.window.HTMLElement); vi.stubGlobal('document',dom.window.document);
 let options; vi.stubGlobal('layer',{open:o=>{options=o;},style:vi.fn()});
 const utils=new Utils(); utils.setupEscClose=vi.fn();
 try {utils.openPage('/v/test','TEST-1'); options.success(null,7);
 Object.defineProperty(window,'innerWidth',{configurable:true,value:390}); window.dispatchEvent(new window.Event('resize'));
 expect(document.querySelector('#layui-layer7').style.width).toBe('374px');
 expect(document.querySelector('iframe').style.height).not.toBe('');
 options.end(); Object.defineProperty(window,'innerWidth',{configurable:true,value:1248}); window.dispatchEvent(new window.Event('resize')); expect(document.querySelector('#layui-layer7').style.width).toBe('374px');
 } finally {dom.window.close(); vi.unstubAllGlobals();}
});
