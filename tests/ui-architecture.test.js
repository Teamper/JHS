import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function getDialogArea(width, height, preset = "md") {
    const presets = { sm: [ 480, 640 ], md: [ 720, 700 ], lg: [ 1040, 760 ], xl: [ 1320, 860 ], workspace: [ 1440, 960 ] };
    const size = presets[preset] || presets.md, inset = width <= 768 ? 16 : "workspace" === preset ? 32 : 64;
    return [ `${Math.max(320, Math.min(size[0], width - inset))}px`, `${Math.max(320, Math.min(size[1], height - inset))}px` ];
}

describe("dialog preset sizing", () => {
    it("uses the small form width", () => expect(getDialogArea(1440, 1000, "sm")).toEqual([ "480px", "640px" ]));
    it("uses the large settings size", () => expect(getDialogArea(1440, 1000, "lg")).toEqual([ "1040px", "760px" ]));
    it("uses the extra-large table size", () => expect(getDialogArea(1600, 1000, "xl")).toEqual([ "1320px", "860px" ]));
    it("caps workspace width at 1440px", () => expect(getDialogArea(1920, 1200, "workspace")).toEqual([ "1440px", "960px" ]));
    it("keeps a 16px total inset on mobile", () => expect(getDialogArea(375, 700, "workspace")).toEqual([ "359px", "684px" ]));
    it("falls back to the medium preset", () => expect(getDialogArea(1200, 900, "unknown")).toEqual([ "720px", "700px" ]));
});

describe("detail workspace adapters", () => {
    const source = readFileSync(join(process.cwd(), "src/plugins/status/detail-workspace.js"), "utf8");
    it("only rearranges hideNav detail iframes", () => expect(source).toMatch(/get\("hideNav"\)/));
    it("keeps separate JavDB and JavBus critical selectors", () => {
        expect(source).toContain(".column-video-cover");
        expect(source).toContain(".column-video-info");
        expect(source).toContain(".screencap");
        expect(source).toContain(".info");
    });
    it("declares all five workspace regions", () => {
        for (const name of [ "summary", "gallery", "resources", "related", "reviews" ]) expect(source).toContain(`this.section("${name}"`);
    });
    it("routes semantic panels into one header and scopes mutation observation", () => {
        expect(source).toContain("data-jhs-section-actions");
        expect(source).toContain("movePanelToSection");
        expect(source).toContain("observer.observe(adapter.root[0]");
        expect(source).not.toContain("observer.observe(document.body");
        expect(source).not.toContain('$("#reviewsFold").parent()');
        expect(source).not.toContain('$("#relatedFold").parent()');
    });
});

describe("list toolbar and UI cleanup contracts", () => {
    const commandbar = readFileSync(join(process.cwd(), "src/plugins/status/mobile-bottom-bar.js"), "utf8");
    const hitShow = readFileSync(join(process.cwd(), "src/plugins/external-search/hit-show.js"), "utf8");
    const translate = readFileSync(join(process.cwd(), "src/plugins/translate/translate.js"), "utf8");
    const settings = readFileSync(join(process.cwd(), "src/plugins/backup/setting-templates.js"), "utf8");
    const settingStyles = readFileSync(join(process.cwd(), "src/plugins/backup/setting-styles.js"), "utf8");
    const pluginPanels = readFileSync(join(process.cwd(), "src/plugins/backup/setting-panels.js"), "utf8");
    const reviews = readFileSync(join(process.cwd(), "src/plugins/external-search/review.js"), "utf8");
    const oneTwoThreeOffline = readFileSync(join(process.cwd(), "src/plugins/one-two-three/offline.js"), "utf8");
    const related = readFileSync(join(process.cwd(), "src/plugins/external-search/related.js"), "utf8");
    const settingForms = readFileSync(join(process.cwd(), "src/plugins/backup/setting-forms.js"), "utf8");
    const listButtons = readFileSync(join(process.cwd(), "src/plugins/status/list-page-button.js"), "utf8");
    const coverButtons = readFileSync(join(process.cwd(), "src/plugins/image-viewer/cover-button.js"), "utf8");
    const injection = readFileSync(join(process.cwd(), "src/core/css-injection.js"), "utf8");

    it("builds the command bar after plugin initialization and keeps semantic actions separate", () => {
        expect(commandbar).toContain("async afterPluginsReady()");
        expect(commandbar).toContain('[ "#waitCheckBtn", "#newVideoBtn", "#historyBtn" ]');
        expect(commandbar).toContain('[ "#statsBtn", "#blacklistBtn" ]');
        expect(commandbar).toMatch(/#addBlacklistBtn[\s\S]*jhs-commandbar__context/);
        expect(commandbar).toMatch(/\[ "#filterAllVideo", "#favoriteAllVideo", "#hasDownAllVideo" \]/);
        expect(commandbar).not.toMatch(/\[ "#addBlacklistBtn", "#filterAllVideo"/);
    });

    it("loads hot-ranking scores in the background with bounded concurrency and stable sorting data", () => {
        expect(hitShow).toContain("void this.loadScore(movies, generation)");
        expect(hitShow).toContain("Math.min(4, queue.length)");
        expect(hitShow).not.toContain("document.hasFocus()");
        expect(hitShow).toContain("data-jhs-rate-count");
        expect(hitShow).toContain("data-jhs-publish-time");
        expect(hitShow).toContain('id="jhs-hitshow-period"');
        expect(hitShow).toContain("jhs-hitshow-heading");
        expect(hitShow).toContain('aria-selected="${"daily" === e ? "true" : "false"}"');
        expect(hitShow).not.toMatch(/is-active|aria-current/);
        expect(hitShow).not.toContain('class="tool-box"');
    });

    it("uses an idempotent translation node and a safe cache key", () => {
        expect(translate).toContain('nextAll(".translated-title").first()');
        expect(translate).toContain('"undefined" !== s');
        expect(translate).toContain('localStorage.setItem("jhs_translate"');
        expect(translate).not.toMatch(/\.html\(/);
    });

    it("keeps exactly the selected eight quick settings", () => {
        const quick = settings.slice(settings.indexOf("function buildQuickSettingHtml"));
        for (const id of [ "showAllItem", "needClosePage", "autoPage", "translateTitle", "hoverBigImg", "enableLoadOtherSite", "enableLoadScreenShot", "enableLoadPreviewVideo" ])
            expect(quick).toContain(`"${id}"`);
        for (const id of [ "showFilterItem", "enableLoadActressInfo", "enableVerticalModel", "containerColumns", "containerWidth" ])
            expect(quick).not.toContain(`id="${id}"`);
    });

    it("renders product labels while retaining internal plugin names as a tooltip", () => {
        expect(settings).toContain('DetailPagePlugin:["JavDB 详情页","detail"]');
        expect(pluginPanels).toContain("jhs-plugin-copy");
        expect(pluginPanels).toContain("内部插件名：");
        expect(pluginPanels).not.toContain("<small title=\"内部插件名\"");
        expect(pluginPanels).toContain("jhs-badge--neutral");
        expect(pluginPanels).not.toContain("checked disabled");
        expect(pluginPanels).toContain("</section>");
    });

    it("keeps quick settings compact and diagnostics collapsed by default", () => {
        expect(settings).toContain('class="simple-setting__list"');
        expect(settings).toContain('<details class="jhs-diagnostics">');
        expect(settings).not.toContain('<details class="jhs-diagnostics" open>');
        expect(settingStyles).toContain("grid-template-columns:minmax(0,1fr) auto");
        expect(settingStyles).not.toMatch(/\.form-content\s+\*/);
        expect(settingStyles).not.toContain("min-height: 180px");
        expect(settings).not.toMatch(/helpBtn|\(\?\)|tooltip-icon/);
        expect(settingForms).not.toMatch(/help-container|常见问题|使用说明|helpBtn/);
        expect(settings).toContain('id="moreBtn" class="jhs-btn jhs-btn--ghost"');
    });

    it("shares quick settings across desktop and mobile without a mobile navbar trigger", () => {
        const settingPlugin = readFileSync(join(process.cwd(), "src/plugins/backup/setting.js"), "utf8");
        expect(settingPlugin).toContain("if (utils.isMobileMode()) return;");
        expect(settingPlugin).toContain("openQuickSetting()");
        expect(settingPlugin).toContain("buildQuickSettingHtml()");
        expect(settingPlugin).toContain('id="jhs-quick-setting-sheet"');
        expect(settingPlugin).toContain('id="jhs-quick-setting-backdrop"');
        const mobileQuickSetting = settingPlugin.slice(settingPlugin.indexOf("openQuickSetting()"), settingPlugin.indexOf("async openSettingDialog"));
        expect(mobileQuickSetting).not.toContain("layer.open(");
        expect(settingPlugin).toMatch(/on\("click", "#setting-btn, #mini-setting-btn"[\s\S]*?\.html\(""\)\.hide\(\)[\s\S]*?openSettingDialog\(\)/);
        expect(commandbar).toContain('this.getBean("SettingPlugin")?.openQuickSetting()');
        expect(commandbar).not.toContain('this.getBean("SettingPlugin")?.openSettingDialog()');
        expect(commandbar).toMatch(/const action = \$\(e\.currentTarget\)\.data\("action"\);\s*closeMenu\(!0\);\s*void this\.handleAction\(action\)\.catch/);
        expect(commandbar).toContain('id="jhs-fab" class="jhs-btn"');
        expect(commandbar).toContain('role="menuitem" class="jhs-btn jhs-fab-menu-item"');
        expect(commandbar).toContain('aria-expanded="false"');
        expect(commandbar).toMatch(/ArrowDown[\s\S]*ArrowUp[\s\S]*Home[\s\S]*End/);
        expect(settingPlugin).toMatch(/previousFocus[\s\S]*isConnected/);
        expect(settingPlugin).toMatch(/"Tab"[\s\S]*shiftKey/);
        expect(settings).toContain("完整设置");
    });

    it("binds full-settings layout ranges idempotently after loading the form", () => {
        expect(settingForms).toContain("bindLayoutRangeEvents();");
        expect(settingForms).toContain('.off(".jhsSetting")');
        expect(settingForms).toContain('.on("input.jhsSetting"');
        expect(settingForms).toContain('.on("change.jhsSetting"');
        expect(settingForms).toContain('saveSettingItem("containerColumns"');
        expect(settingForms).toContain('saveSettingItem("containerWidth"');
        expect(settingForms).toContain("await applyImageMode()");
        const rangeBinding = settingForms.slice(settingForms.indexOf("function bindLayoutRangeEvents"), settingForms.indexOf("async function initQuickSettingForm"));
        const columnsInput = rangeBinding.slice(rangeBinding.indexOf('on("input.jhsSetting"'), rangeBinding.indexOf('on("change.jhsSetting"'));
        expect(columnsInput).not.toContain("saveSettingItem");
        const quickForm = settingForms.slice(settingForms.indexOf("async function initQuickSettingForm"));
        expect(quickForm).not.toContain('$("#containerColumns").on("input"');
        expect(quickForm).not.toContain('$("#containerWidth").on("input"');
    });

    it("uses semantic review and related layouts with safe external text", () => {
        expect(reviews).toContain("jhs-review-item");
        expect(reviews).toContain("document.createTextNode");
        expect(reviews).toContain("appendLinkControls");
        expect(reviews).not.toContain("item columns is-desktop");
        expect(reviews).not.toContain("jhs-layout-");
        expect(related).toContain("jhs-related-item");
        expect(related).toContain("encodeURIComponent(item.relatedId)");
        expect(related).not.toContain("item columns is-desktop");
        expect(related).not.toContain("jhs-layout-");
        expect(reviews).toMatch(/jhs-review-content[^}]*font-size:16px[^}]*line-height:1\.7/);
        expect(reviews).not.toMatch(/jhs-review-content[^}]*max-width/);
        expect(related).toContain("jhs-related-heading");
    });

    it("routes ED2K only to 115 and rejects non-Magnet 123 submissions", () => {
        expect(reviews).toContain('isMagnet && actions.append(`<button type="button" class="jhs-btn jhs-review-link jhs-review-offline-btn one23-offline-btn"');
        const submitMagnet = oneTwoThreeOffline.slice(oneTwoThreeOffline.indexOf("async submitMagnet"), oneTwoThreeOffline.indexOf("async markCurrentVideoAsHasDown"));
        expect(submitMagnet).toContain('if (!/^magnet:/i.test(e)) return void show.error("123 云盘当前仅支持 Magnet 离线")');
        expect(submitMagnet.indexOf("/^magnet:/i.test(e)")).toBeLessThan(submitMagnet.indexOf("this.getStoredToken()"));
    });

    it("uses semantic keyboard popovers and stable sort storage", () => {
        expect(listButtons).toContain('role="menuitemradio"');
        expect(listButtons).toContain('localStorage.setItem("jhs_sortMethod"');
        for (const key of [ "ArrowDown", "ArrowUp", "Home", "End", "Escape" ]) expect(listButtons).toContain(key);
        expect(listButtons).not.toMatch(/<select[^>]+sort-toggle-btn/);
        expect(coverButtons).toContain("width:152px");
        expect(coverButtons).toContain("jhs-card-menu__dot");
        expect(coverButtons).not.toMatch(/elastic|jelly|right:\s*-/);
    });

    it("resets host cover animation without touching hover preview lifecycle", () => {
        expect(injection).toMatch(/\.movie-list \.item \.cover img[\s\S]*transform:none!important[\s\S]*transition:none!important/);
        expect(injection).not.toMatch(/scale\(1\.04\)|\.masonry \.item:hover/);
    });
});
