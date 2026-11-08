import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { OwnedPopover, closeOwnedPopover } from "../src/core/owned-popover.js";
import { DesktopQuickSettings } from "../src/ui/settings/desktop-quick-settings.js";

afterEach(() => vi.useRealTimers());
function setup(initialize) {
    vi.useFakeTimers();
    const dom = new JSDOM('<button id="outside">外部操作</button><div id="box"><button id="trigger">设置</button><div id="host" style="display:none"><input><button id="select">选择</button><div id="menu"><button>选项</button></div></div></div>');
    const doc = dom.window.document, jq = jqueryFactory(dom.window), scope = new LifecycleScope("test");
    const surface = new DesktopQuickSettings({box:doc.querySelector('#box'),host:doc.querySelector('#host'),jquery:jq,scope,initialize:initialize ?? vi.fn(async () => {}),onError:vi.fn(),onOpen:vi.fn()});
    const pointer = node => node.dispatchEvent(new dom.window.Event('pointermove', {bubbles:true}));
    return {dom,doc,jq,scope,surface,pointer};
}
describe('desktop quick settings logical hover region', () => {
    it('starts the full close delay when leaving after focus changes inside the hover region', async () => {
        const {doc,surface,pointer,scope} = setup();
        await surface.open();
        pointer(doc.querySelector('#trigger'));
        doc.querySelector('#outside').focus();
        await vi.advanceTimersByTimeAsync(150);
        pointer(doc.body);
        await vi.advanceTimersByTimeAsync(100);
        expect(surface.opened).toBe(true);
        await vi.advanceTimersByTimeAsync(100);
        expect(surface.opened).toBe(false);
        scope.dispose();
    });
    it('bridges the gap for 200ms, retains focus and reuses a single initialization', async () => {
        const initialize = vi.fn(async () => {}), {doc,jq,surface,pointer,scope} = setup(initialize);
        await surface.open();
        pointer(doc.body);await vi.advanceTimersByTimeAsync(199);expect(surface.opened).toBe(true);
        pointer(surface.host);await vi.advanceTimersByTimeAsync(201);expect(surface.opened).toBe(true);
        doc.querySelector('input').focus();pointer(doc.body);await vi.advanceTimersByTimeAsync(201);expect(surface.opened).toBe(true);
        doc.querySelector('#outside').focus();await vi.advanceTimersByTimeAsync(201);expect(jq(surface.host).css('display')).toBe('none');
        await surface.open();expect(initialize).toHaveBeenCalledOnce();scope.dispose();expect(surface.scope.snapshot().listeners).toBe(0);
    });
    it('includes the portalled select and consumes Escape from child to parent', async () => {
        const {doc,dom,surface,pointer,scope} = setup();await surface.open();
        const select = new OwnedPopover(doc.querySelector('#select'), doc.querySelector('#menu'));select.open();
        pointer(select.menu);await vi.advanceTimersByTimeAsync(250);expect(surface.opened).toBe(true);
        select.menu.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
        expect(select.opened).toBe(false);expect(surface.opened).toBe(true);expect(doc.activeElement.id).toBe('select');
        doc.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
        expect(surface.opened).toBe(false);expect(doc.activeElement.id).toBe('trigger');scope.dispose();
    });
    it('ignores a late initialization after close or unmount', async () => {
        let resolve;const initialize = vi.fn(() => new Promise(done => resolve = done));
        const {surface,jq,scope} = setup(initialize);const pending=surface.open();surface.close();resolve();await pending;
        expect(jq(surface.host).css('display')).toBe('none');await surface.open();expect(initialize).toHaveBeenCalledOnce();
        scope.dispose();await surface.open();expect(jq(surface.host).css('display')).toBe('none');
    });
    it('releases pending initialization and parent cleanup ownership on unmount', async () => {
        let resolve;const {surface,scope,jq}=setup(()=>new Promise(done=>resolve=done));
        const pending=surface.open();surface.dispose();resolve();await pending;
        expect(jq(surface.host).css('display')).toBe('none');expect(surface.scope.snapshot().listeners).toBe(0);expect(scope.cleanups.size).toBe(0);
    });
    it('outside capture closes even when the target stops propagation and keeps its focus', async () => {
        const {dom,doc,surface,scope} = setup();await surface.open();
        const menu=new OwnedPopover(doc.querySelector('#select'),doc.querySelector('#menu'));menu.open();
        const outside=doc.querySelector('#outside');outside.addEventListener('pointerdown',event=>event.stopPropagation());outside.focus();
        outside.dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true}));expect(menu.opened).toBe(false);expect(surface.opened).toBe(false);expect(doc.activeElement).toBe(outside);
        closeOwnedPopover(doc);scope.dispose();
    });
});

it('recovers on real pointer movement over a newly mounted trigger',async()=>{
 const {doc,surface,pointer,scope}=setup();
 pointer(doc.querySelector('#trigger'));
 await vi.waitFor(()=>expect(surface.ready).toBe(true));
 expect(surface.opened).toBe(true);scope.dispose();
});
it('shows initialization failure and retries successfully',async()=>{
 const initialize=vi.fn().mockRejectedValueOnce(Error('fixture')).mockResolvedValueOnce(undefined);
 const {surface,jq,scope}=setup(initialize);await surface.open();
 expect(jq(surface.host).css('display')).not.toBe('none');expect(surface.host.textContent).toContain('重试');
 surface.host.querySelector('button').click();await vi.waitFor(()=>expect(surface.ready).toBe(true));
 expect(initialize).toHaveBeenCalledTimes(2);scope.dispose();
});

it('rebuilds a ready host if an external owner removed its contents',async()=>{
 const {surface,scope}=setup(vi.fn(async()=>{surface.host.innerHTML='<input>'; }));
 await surface.open();surface.close();surface.host.replaceChildren();
 await surface.open();expect(surface.options.initialize).toHaveBeenCalledTimes(2);
 expect(surface.host.querySelector('input')).not.toBeNull();scope.dispose();
});
