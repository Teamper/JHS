import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import jquery from "jquery";
import { PreviewVideoPlugin } from "../src/plugins/image-viewer/preview-video.js";
import { initializeRuntimeConstants } from "../src/core/constants.js";
const preview = readTestFile(join(import.meta.dirname, "../src/plugins/image-viewer/preview-video.js"), "utf8");
const bus = readTestFile(join(import.meta.dirname, "../src/plugins/image-viewer/bus-preview-video.js"), "utf8");
const cover = readTestFile(join(import.meta.dirname, "../src/plugins/image-viewer/cover-button.js"), "utf8");
let dom, plugin;
function setup({ open = true, playing = true, dmm = true, muted = false } = {}) {
    dom = new JSDOM(`<div class="${open ? "fancybox-content" : "hidden-source"}"><video id="preview-video" src="https://example.test/native.m3u8"></video></div>`, { url: "https://javdb.com/v/test" });
    const $ = jquery(dom.window), settings = { enablePreviewVideo: "yes", enableLoadPreviewVideo: dmm ? "yes" : "no", videoMuted: muted };
    for (const [key,value] of Object.entries({window:dom.window,document:dom.window.document,$,getComputedStyle:dom.window.getComputedStyle.bind(dom.window),MutationObserver:dom.window.MutationObserver,clog:{warn(){},error(){},debug(){}},show:{error:vi.fn()}})) vi.stubGlobal(key,value);
    initializeRuntimeConstants(dom.window.location);
    Object.defineProperty(dom.window.HTMLMediaElement.prototype, "paused", { configurable:true,get(){return this.dataset.playing !== "true";} });
    dom.window.HTMLMediaElement.prototype.play = vi.fn(async function(){ this.dataset.playing = "true"; });
    dom.window.HTMLMediaElement.prototype.pause = vi.fn(function(){this.dataset.playing = "false";});
    dom.window.HTMLMediaElement.prototype.load = vi.fn();
    Object.defineProperty(dom.window.HTMLMediaElement.prototype, "readyState", {configurable:true,get(){return 4;}});
    const native = $("video")[0]; native.dataset.playing = String(playing); native.currentTime = 7;
    plugin = new PreviewVideoPlugin(); plugin.getRuntimeService = () => ({ snapshot:()=>settings, set:async(key,value)=>{settings[key]=value;} }); plugin.getOptionalDependency = ()=>null;
    plugin.getDmmPreview = async()=>({sources:{mhb_w:"https://example.test/dmm.mp4"},error:null});
    return { $,native,settings };
}
afterEach(()=>{plugin?.disposePreviewSession();dom?.window.close();vi.useRealTimers();vi.unstubAllGlobals();});
describe("preview playback contracts", () => {
    it("returns to native after DMM readiness times out without changing pause",async()=>{
        vi.useFakeTimers(); const {native}=setup({playing:false});
        Object.defineProperty(dom.window.HTMLMediaElement.prototype,"readyState",{configurable:true,get(){return 0;}});
        const pending=plugin.handleVideo();
        await vi.advanceTimersByTimeAsync(10001); await pending;
        expect(native.classList.contains("jhs-native-preview-hidden")).toBe(false);
        expect(native.paused).toBe(true);
        expect(document.querySelector("#jhs-preview-video")).toBeNull();
        expect(document.querySelector("#speed-btn")).not.toBeNull();
    });
    it("releases a pending readiness wait when its preview closes",async()=>{
        const {native}=setup({playing:false});
        Object.defineProperty(dom.window.HTMLMediaElement.prototype,"readyState",{configurable:true,get(){return 0;}});
        const pending=plugin.handleVideo(); await Promise.resolve(); await Promise.resolve();
        plugin.disposePreviewSession(); await pending;
        expect(document.querySelector("#video-bottom-toolbar")).toBeNull();
        expect(native.paused).toBe(true);
    });
    it("does not hide a paused native preview before DMM can load",async()=>{
        const {native}=setup({playing:false});
        Object.defineProperty(dom.window.HTMLMediaElement.prototype, "readyState", {configurable:true,get(){return 0;}});
        const pending=plugin.handleVideo(); await Promise.resolve(); await Promise.resolve();
        expect(native.classList.contains("jhs-native-preview-hidden")).toBe(false);
        document.querySelector("#jhs-preview-video").dispatchEvent(new dom.window.Event("error"));
        await pending;
        expect(native.classList.contains("jhs-native-preview-hidden")).toBe(false);
        expect(native.paused).toBe(true);
    });
    it("never starts or mounts controls on an unopened native source",async()=>{
        const {native}=setup({open:false}); await plugin.handleVideo();
        expect(native.play).not.toHaveBeenCalled(); expect(document.querySelector("#video-bottom-toolbar")).toBeNull();
    });
    it("keeps native playback and its HLS source intact while DMM is pending",async()=>{
        const {native}=setup(); let resolve; plugin.getDmmPreview=()=>new Promise(done=>{resolve=done;});
        const pending=plugin.handleVideo();
        expect(native.paused).toBe(false); expect(native.getAttribute("src")).toBe("https://example.test/native.m3u8"); expect(native.load).not.toHaveBeenCalled();
        resolve({sources:null,error:null}); await pending;
        expect(document.querySelector("#speed-btn")).not.toBeNull(); expect(native.paused).toBe(false);
    });
    it("isolates DMM from native HLS and restores time and playback on DMM OFF",async()=>{
        const {native,settings}=setup(); await plugin.handleVideo();
        const dmm=document.querySelector("#jhs-preview-video"); expect(dmm.getAttribute("src")).toContain("dmm.mp4"); expect(native.paused).toBe(true);
        dmm.currentTime=23; settings.enableLoadPreviewVideo="no"; plugin.unmountDmmPlayer();
        expect(native.currentTime).toBe(23); expect(native.paused).toBe(false); expect(native.getAttribute("src")).toContain("native.m3u8");
        expect(document.querySelector("#jhs-preview-video")).toBeNull(); expect(document.querySelector("#speed-btn")).not.toBeNull();
    });
    it("preserves a user-paused preview when enhancing and restoring it",async()=>{
        const {native,settings}=setup({playing:false}); await plugin.handleVideo();
        expect(document.querySelector("#jhs-preview-video").paused).toBe(true);
        settings.enableLoadPreviewVideo="no"; plugin.unmountDmmPlayer(); expect(native.paused).toBe(true); expect(native.play).not.toHaveBeenCalled();
    });
    it("shows DMM before play and retries autoplay with mute before hiding native",async()=>{
        const {native}=setup(); const attempts=[];
        dom.window.HTMLMediaElement.prototype.play=vi.fn(async function(){ attempts.push({muted:this.muted,visible:this.classList.contains("is-active"),nativePaused:native.paused}); if(!this.muted) throw new Error("autoplay denied"); this.dataset.playing="true"; });
        await plugin.handleVideo();
        expect(attempts).toEqual([{muted:false,visible:true,nativePaused:false},{muted:true,visible:true,nativePaused:false}]);
        expect(native.paused).toBe(true); expect(document.querySelector("#jhs-preview-video").muted).toBe(true);
    });
    it("shares quality controls and exposes pressed state on both sites", () => {
        for (const source of [ preview, bus ]) {
            expect(source).toContain("jhs-video-quality-btn"); expect(source).toContain("aria-pressed"); expect(source).not.toContain("video-control-btn");
        }
    });
    it("injects the movie service and lifecycle scope for every remote DMM preview", () => {
        for (const source of [bus, cover]) {
            expect(source).toContain('getRuntimeService("movie")');
            expect(source).toContain('getRuntimeService("scope")()');
            expect(source).toMatch(/fetchDmmPreviewIfEnabled\([^\n]+getRuntimeService\("storage"\)[^\n]+getRuntimeService\("movie"\)[^\n]+scope[^\n]+(?:settings|snapshot\(\))\)/);
        }
    });
    it("keeps native play calls inside safePlay only", () => {
        const allRuntime = [ preview, bus, cover, readTestFile(join(import.meta.dirname, "../src/features/list/list-filters.js"), "utf8"), readTestFile(join(import.meta.dirname, "../src/plugins/status/list-page.js"), "utf8") ].join("\n");
        expect(allRuntime).not.toMatch(/\.play\s*\(/);
    });
    it("does not interpolate remote media URLs into HTML templates", () => {
        expect(bus).not.toContain('<source src="${a}"');
        expect(bus).not.toContain('data-video-src="${a}"');
        expect(cover).not.toContain('<video src="${c}" poster="${s}"');
    });
});
