import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const preview = readFileSync(join(import.meta.dirname, "../src/plugins/image-viewer/preview-video.js"), "utf8");
const bus = readFileSync(join(import.meta.dirname, "../src/plugins/image-viewer/bus-preview-video.js"), "utf8");

describe("preview playback contracts", () => {
    it("starts the native JavDB preview before awaiting DMM without taking over its source", () => {
        const handle = preview.slice(preview.indexOf("async handleVideo()"));
        expect(handle.indexOf("void safePlay(nativeVideo")).toBeLessThan(handle.indexOf("await this.getDmmPreview"));
        expect(handle).not.toContain("await nativePlayPromise");
        expect(handle).not.toContain('$nativeVideo.attr("src"');
        expect(handle).not.toContain("nativeVideo.load()");
        expect(preview).not.toContain("nativePreviewSrc");
        expect(preview).not.toContain("rememberNativeSource");
        expect(handle).toContain('find("#video-bottom-toolbar").remove()');
    });
    it("treats high-quality preview as an enhancement instead of disabling native playback", () => {
        const handle = preview.slice(preview.indexOf("async handleVideo()"));
        expect(handle.indexOf("void safePlay(nativeVideo")).toBeLessThan(handle.indexOf('getSetting("enableLoadPreviewVideo"'));
        expect(handle).toContain("dmmEnabled ? await this.getDmmPreview()");
        expect(preview.slice(preview.indexOf("async initDmm()"), preview.indexOf("async handleVideo()"))).not.toMatch(/attr\("src", source\)/);
    });
    it("retries transient DMM fetches and activates quality only after playback succeeds", () => {
        expect(preview).toContain("this.dmmPreviewPromise = null");
        expect(preview).toContain('"HTTP_ERROR" === result.error?.code');
        expect(preview).toContain("const active = dmmPlayed && selectedQuality === quality.quality");
        expect(preview).toMatch(/dmmPlayed = await safePlay\(dmmVideo[\s\S]+restoreNativePlayer/);
    });
    it("isolates DMM playback from the JavDB hls.js media element", () => {
        expect(preview).toContain('id="jhs-preview-video"');
        expect(preview).toContain('$dmmVideo.attr("src", source), dmmVideo.load()');
        expect(preview).toContain('nativeVideo.pause(), $nativeVideo.addClass("jhs-native-preview-hidden")');
        expect(preview).toContain('$dmmVideo.removeAttr("src"), dmmVideo.load(), $dmmVideo.remove()');
        expect(preview).not.toContain("video.currentSrc");
    });
    it("shows DMM before playback and uses a muted autoplay fallback", () => {
        const handle = preview.slice(preview.indexOf("async handleVideo()"));
        expect(handle).toContain('dmmVideo.muted = !muted || "yes" === muted');
        expect(handle.indexOf('$dmmVideo.addClass("is-active")')).toBeLessThan(handle.indexOf("dmmPlayed = await safePlay(dmmVideo"));
        expect(handle).toMatch(/if \(!dmmPlayed && !dmmVideo\.muted\)[\s\S]+JavDB 高画质预览静音重试/);
        expect(handle.indexOf("高画质预览静音重试")).toBeLessThan(handle.indexOf("await this.restoreNativePlayer"));
    });
    it("shares quality controls and exposes pressed state on both sites", () => {
        for (const source of [ preview, bus ]) {
            expect(source).toContain("jhs-video-quality-btn"); expect(source).toContain("aria-pressed"); expect(source).not.toContain("video-control-btn");
        }
    });
    it("keeps native play calls inside safePlay only", () => {
        const allRuntime = [ preview, bus, readFileSync(join(import.meta.dirname, "../src/plugins/image-viewer/cover-button.js"), "utf8"), readFileSync(join(import.meta.dirname, "../src/plugins/status/list-page.js"), "utf8") ].join("\n");
        expect(allRuntime).not.toMatch(/\.play\s*\(/);
    });
});
