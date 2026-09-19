import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const previewVideo = readTestFile(join(process.cwd(), "src/plugins/image-viewer/preview-video.js"), "utf8");
const coverButton = readTestFile(join(process.cwd(), "src/plugins/image-viewer/cover-button.js"), "utf8");
const busPreview = readTestFile(join(process.cwd(), "src/plugins/image-viewer/bus-preview-video.js"), "utf8");
const listPage = readTestFile(join(process.cwd(), "src/plugins/status/list-page.js"), "utf8");
const translate = readTestFile(join(process.cwd(), "src/plugins/translate/translate.js"), "utf8");
const titleTranslation = readTestFile(join(process.cwd(), "src/ui/translation/title-translation.js"), "utf8");
const fc2 = readTestFile(join(process.cwd(), "src/plugins/external-search/fc2.js"), "utf8");
const otherSite = readTestFile(join(process.cwd(), "src/plugins/external-search/other-site.js"), "utf8");
const navBar = readTestFile(join(process.cwd(), "src/plugins/status/nav-bar.js"), "utf8");
const autoPage = readTestFile(join(process.cwd(), "src/plugins/status/auto-page.js"), "utf8");

describe("RC 收口：async 回流 gate", () => {
    it("preview-video marks the artificial DMM trigger and gates every await boundary", () => {
        expect(previewVideo).toContain('data-jhs-dmm-trigger="true"');
        expect(previewVideo).toContain("$('[data-jhs-dmm-trigger]').remove()");
        expect(previewVideo).toContain("generation !== this.previewGeneration");
        expect(previewVideo).toContain("!isPreviewEnabled(settings.snapshot()) || !isDmmEnabled(settings.snapshot())");
    });

    it("cover-button and JavBus preview invalidate in-flight DMM fetches on OFF", () => {
        expect(coverButton).toContain("this.previewGeneration++");
        expect(coverButton).toContain("generation !== this.previewGeneration || !isPreviewEnabled(");
        expect(busPreview).toContain("this._busPreviewGeneration++");
        expect(busPreview).toContain("generation !== this._busPreviewGeneration || !isPreviewEnabled(");
    });

    it("list/FC2 translation invalidates stale requests and title-translation checks isActive", () => {
        expect(listPage).toContain("this.translationGeneration = 0");
        expect(listPage).toContain("invalidateTranslations()");
        expect(listPage).toContain("generation !== this.translationGeneration");
        expect(translate).toContain("?.invalidateTranslations?.()");
        expect(titleTranslation).toContain("options.isActive && !options.isActive()");
        expect(titleTranslation).toContain("if (options.isActive && options.isActive() === false) return;");
        expect(fc2).toContain("if (!context.isAlive() || (settings.snapshot().translateTitle ?? _) !== _) return;");
        expect(fc2).toContain("context.translationGeneration = (context.translationGeneration || 0) + 1");
        expect(fc2).toContain("generation === context.translationGeneration");
    });

    it("other-site invalidates in-flight mounts and combines the settings gate", () => {
        expect(otherSite).toContain("this.mountGeneration = 0");
        expect(otherSite).toContain("generation === this.mountGeneration");
        expect(otherSite).toContain('settingsService.snapshot().enableLoadOtherSite !== "no"');
        expect(fc2).toContain('settings.snapshot().enableLoadOtherSite !== "no"');
    });
});

describe("RC 收口：UI surface 与宿主 DOM 边界", () => {
    it("old search image is left untouched when the image-search plugin is disabled", () => {
        expect(navBar).toMatch(/hookOldSearch\(\)\s*\{[\s\S]{0,240}?if \(!hasSearchByImage\) return;[\s\S]{0,200}?cloneNode/);
    });

    it("AutoPage stops on feature scope dispose and unifies the first-start promise", () => {
        expect(autoPage).toContain("scope.addCleanup((() => this.stop()))");
        expect(autoPage).toContain("this.waterfallPromise = this.waterfall().finally");
    });
});

describe("RC 收口：预览 capability / FC2 稳定槽与翻译单入口", () => {
    const fc2By123 = readTestFile(join(process.cwd(), "src/plugins/external-search/fc2-by-123av.js"), "utf8");
    const commandbar = readTestFile(join(process.cwd(), "src/plugins/status/mobile-bottom-bar.js"), "utf8");
    const setting = readTestFile(join(process.cwd(), "src/plugins/backup/setting.js"), "utf8");

    it("card and JavBus preview buttons are gated by real DMM capability", () => {
        expect(coverButton).toContain("canUseCardPreview(settings)");
        expect(coverButton).toContain('names.some((name) => name === "enablePreviewVideo" || name === "enableLoadPreviewVideo")');
        expect(busPreview).toContain("canUseDmmPreview(settings)");
    });

    it("FC2 translation has exactly one entry and catch paths honor isActive", () => {
        expect(fc2).toContain("context.translationGeneration");
        expect(fc2).toContain("generation === context.translationGeneration");
        expect(fc2By123).not.toContain("renderTranslatedTitle");
        expect(titleTranslation).toContain("if (options.isActive && !options.isActive()) return;");
        const catchBlock = titleTranslation.slice(titleTranslation.indexOf("} catch (error) {"), titleTranslation.indexOf('translatedNode.addClass("is-error")'));
        expect(catchBlock).toContain("options.isActive");
        expect(catchBlock).toContain("isConnected");
    });

    it("FC2 slots stay stable and OtherSite generation is per-context", () => {
        expect(fc2).not.toContain("if (!result && !screenshot.children().length) screenshot.remove()");
        expect(fc2).toContain("box ? sitesGroup.show() : sitesGroup.hide()");
        expect(otherSite).toContain("this._mountGenerations = new WeakMap()");
        expect(otherSite).toContain("rootElement ? generation === this._mountGenerations.get(rootElement)");
    });

    it("commandbar parks sources in a hidden container and removes the shell", () => {
        const unmount = commandbar.slice(commandbar.indexOf("unmountDesktopCommandBar() {"), commandbar.indexOf("buildCommandBar() {"));
        expect(unmount).toContain("#jhs-commandbar-parking");
        expect(unmount).toContain("parking.append(element)");
        expect(unmount).not.toContain("].reverse()");
        expect(unmount.indexOf('#jhs-page-commandbar").remove()')).toBeGreaterThan(unmount.indexOf("_commandBarSources"));
        expect(commandbar).not.toContain('$(".jhs-list-btn-row").filter');
        expect(setting).toContain('i(this, "_desktopNavGeneration", 0)');
        expect(setting).toContain("this._desktopNavGeneration++");
        expect(setting).toContain("generation !== this._desktopNavGeneration");
    });
});
