import { readTestFile } from "./helpers/read-test-file.js";
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
    const source = readTestFile(join(process.cwd(), "src/plugins/status/detail-workspace.js"), "utf8");
    const javdbHost = readTestFile(join(process.cwd(), "src/platform/hosts/javdb-host-adapter.js"), "utf8");
    const javbusHost = readTestFile(join(process.cwd(), "src/platform/hosts/javbus-host-adapter.js"), "utf8");
    it("keeps the protected JavDB controller and resource root as an adapter boundary", () => {
        expect(javdbHost).toContain('[data-controller="magnet-sort"]');
        expect(javdbHost).toContain('querySelector("#magnets-content")');
        expect(javbusHost).toContain('querySelector("#magnet-table")');
        expect(source).not.toContain("#magnet-table");
    });
    it("declares only JHS-owned host slots", () => {
        for (const name of [ "summary-actions", "related", "reviews" ]) expect(source).toContain(`data-jhs-slot="${name}"`);
    });
    it("adopts owned panels once and observes only resource lifecycle changes", () => {
        expect(source).toContain("adoptExistingOwnedPanels(root)");
        expect(source).toContain("this.lifecycleScope.observe(adapter.observeRoot[0]");
        expect(source).toContain("releaseObserver(this.resourceObserver)");
        expect(source).toContain('jhsEventBus.emit("magnet-items-updated"');
        expect(source).not.toContain("observer.observe(document.body");
        for (const legacy of [ "routeSections", "moveToSection", "movePanelToSection" ]) expect(source).not.toContain(legacy);
    });
});

describe("list toolbar and UI cleanup contracts", () => {
    const commandbar = readTestFile(join(process.cwd(), "src/plugins/status/mobile-bottom-bar.js"), "utf8");
    const hitShow = readTestFile(join(process.cwd(), "src/plugins/external-search/hit-show.js"), "utf8");
    const translate = readTestFile(join(process.cwd(), "src/plugins/translate/translate.js"), "utf8");
    const translationUi = readTestFile(join(process.cwd(), "src/ui/translation/title-translation.js"), "utf8");
    const settings = readTestFile(join(process.cwd(), "src/plugins/backup/setting-templates.js"), "utf8");
    const settingPlugin = readTestFile(join(process.cwd(), "src/plugins/backup/setting.js"), "utf8");
    const settingStyles = readTestFile(join(process.cwd(), "src/plugins/backup/setting-styles.js"), "utf8");
    const pluginPanels = readTestFile(join(process.cwd(), "src/plugins/backup/setting-panels.js"), "utf8");
    const reviews = readTestFile(join(process.cwd(), "src/plugins/external-search/review.js"), "utf8");
    const reviewUi = readTestFile(join(process.cwd(), "src/ui/detail/review-panel.js"), "utf8");
    const oneTwoThreeOffline = readTestFile(join(process.cwd(), "src/plugins/one-two-three/offline.js"), "utf8");
    const pan123Integration = readTestFile(join(process.cwd(), "src/integrations/pan123/manifest.js"), "utf8");
    const newVideo = readTestFile(join(process.cwd(), "src/plugins/new-video/new-video.js"), "utf8");
    const related = readTestFile(join(process.cwd(), "src/plugins/external-search/related.js"), "utf8");
    const relatedUi = readTestFile(join(process.cwd(), "src/ui/detail/related-panel.js"), "utf8");
    const otherSite = readTestFile(join(process.cwd(), "src/plugins/external-search/other-site.js"), "utf8");
    const magnetHub = readTestFile(join(process.cwd(), "src/plugins/external-search/magnet-hub.js"), "utf8");
    const settingForms = readTestFile(join(process.cwd(), "src/plugins/backup/setting-forms.js"), "utf8");
    const listButtons = readTestFile(join(process.cwd(), "src/plugins/status/list-page-button.js"), "utf8");
    const coverButtons = readTestFile(join(process.cwd(), "src/plugins/image-viewer/cover-button.js"), "utf8");
    const previewVideo = readTestFile(join(process.cwd(), "src/plugins/image-viewer/preview-video.js"), "utf8");
    const injection = readFileSync(join(process.cwd(), "src/core/css-injection.js"), "utf8");
    const bootstrap = readFileSync(join(process.cwd(), "src/app/bootstrap.js"), "utf8");
    const detailButtons = readTestFile(join(process.cwd(), "src/plugins/status/detail-page-button.js"), "utf8");
    const top250 = readTestFile(join(process.cwd(), "src/plugins/external-search/top250.js"), "utf8");

    it("builds the command bar after plugin initialization and keeps semantic actions separate", () => {
        expect(commandbar).toContain("async afterPluginsReady()");
        expect(commandbar).toContain("syncSurfaces()");
        expect(commandbar).toContain("mountDesktopCommandBar()");
        expect(commandbar).toContain("unmountDesktopCommandBar()");
        expect(commandbar).toContain('[ "#waitCheckBtn", "#newVideoBtn", "#historyBtn" ]');
        expect(commandbar).toContain('[ "#statsBtn", "#blacklistBtn" ]');
        expect(commandbar).toMatch(/#addBlacklistBtn[\s\S]*jhs-commandbar__context/);
        expect(commandbar).toMatch(/\[ "#filterAllVideo", "#favoriteAllVideo", "#hasDownAllVideo" \]/);
        expect(commandbar).not.toMatch(/\[ "#addBlacklistBtn", "#filterAllVideo"/);
        expect(commandbar).toContain('quickFilter.detach()');
        expect(commandbar).toContain("jhs-mobile-filter-menu");
        expect(commandbar).toContain('item("quickFilter"');
        expect(commandbar).toContain('hasListPageButton ? item("check", "开始鉴定") : "") + (hasNewVideo ? item("newVideo", "新作品") : "") + (hasBlacklist ? item("blacklist", "黑名单") : "") + (hasListPageButton ? item("sort"');
        expect(commandbar).toContain(': "") + (hasListPage ? item("quickFilter"');
        expect(commandbar).toContain('+ divider + group(item("logger", "运行日志") + (hasSetting ? item("setting", "设置") : ""))');
        expect(commandbar).toContain('const hasListPageButton = !!this.getBean("ListPageButtonPlugin")');
        expect(commandbar).toContain('await this.getBean("ListPageButtonPlugin")?.openWaitCheck?.()');
        expect(commandbar).not.toContain('$("#waitCheckBtn").click()');
        expect(commandbar).not.toMatch(/\.jhs-commandbar__filters\s*\{[^}]*overflow-x\s*:\s*auto/);
        expect(commandbar).not.toMatch(/@media \(max-width:\s*1023px\)[\s\S]*?\.jhs-page-commandbar\s*\{[^}]*overflow-x\s*:\s*auto/);
        expect(commandbar).toMatch(/@media \(max-width:\s*1023px\)[\s\S]*?\.jhs-page-commandbar\s*\{[^}]*flex-wrap:\s*wrap[^}]*overflow:\s*visible/);
        expect(commandbar).toMatch(/@media \(max-width:\s*768px\)[\s\S]*?\.jhs-page-commandbar\s*\{[^}]*display:\s*none/);
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
        expect(translationUi).toContain('nextAll(".translated-title").first()');
        expect(translate).toContain('getRuntimeService("translation")');
        expect(translate).not.toContain("localStorage");
        expect(translationUi).not.toMatch(/\.html\(/);
        expect(translate).not.toMatch(/\.html\(/);
    });

    it("keeps exactly the canonical quick settings from the settings registry", () => {
        const catalog = readFileSync(join(process.cwd(), "src/app/settings-catalog.js"), "utf8");
        for (const id of [ "needClosePage", "autoPage", "translateTitle", "hoverBigImg", "enableLoadOtherSite", "enableLoadActressInfo", "enableLoadScreenShot", "enablePreviewVideo", "enableLoadPreviewVideo", "enableVerticalModel" ])
            expect(catalog).toContain(`"${id}"`);
        // 快捷设置由唯一 renderer 从 registry 生成，模板不再手写任何开关行
        expect(settings).toContain("buildQuickSettingsHtml(registry, options)");
        expect(settings).not.toContain('id="enableScreenSvg"');
        for (const id of [ "showAllItem", "showFavoriteItem", "showHasDownItem", "showHasWatchItem", "showFilterItem", "enableLoadActressInfo", "enableVerticalModel" ])
            expect(settings).not.toContain(`id="${id}"`);
    });

    it("removes retired hard-hidden visibility settings from every UI and form path", () => {
        for (const id of [ "showAllItem", "showFavoriteItem", "showHasDownItem", "showHasWatchItem", "showFilterItem", "showFilterActorItem", "showFilterKeywordItem" ]) {
            expect(settings).not.toContain(id);
            expect(settingForms).not.toContain(id);
        }
        expect(settingForms).toContain("normalizeQuickFilterKey(e.defaultQuickFilterTab)");
        expect(settingPlugin).toContain('normalizeQuickFilterKey(root.find("#defaultQuickFilterTab").val())');
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
        const settingPlugin = readTestFile(join(process.cwd(), "src/plugins/backup/setting.js"), "utf8");
        expect(settingPlugin).toContain("syncDesktopSettingNav(");
        expect(settingPlugin).toContain("mountDesktopSettingNav()");
        expect(settingPlugin).toContain("unmountDesktopSettingNav()");
        expect(settingPlugin).toContain("openQuickSetting()");
        expect(settingPlugin).toContain('buildQuickSettingHtml(this.getRuntimeService("settingsRegistry"))');
        expect(settingPlugin).toContain('id="jhs-quick-setting-sheet"');
        expect(settingPlugin).toContain('id="jhs-quick-setting-backdrop"');
        const mobileQuickSetting = settingPlugin.slice(settingPlugin.indexOf("openQuickSetting()"), settingPlugin.indexOf("async openSettingDialog"));
        expect(mobileQuickSetting).not.toContain("layer.open(");
        expect(settingPlugin).toMatch(/scope\.listen\(document, "click"[\s\S]*?closest\("#setting-btn, #mini-setting-btn"\)[\s\S]*?\.html\(""\)\.hide\(\)[\s\S]*?openSettings\(\)/);
        expect(commandbar).toContain('this.getBean("SettingPlugin")?.openQuickSetting()');
        expect(commandbar).not.toContain('this.getBean("SettingPlugin")?.openSettingDialog()');
        expect(commandbar).toMatch(/const action = \$\(e\.currentTarget\)\.data\("action"\);[\s\S]*"quickFilter" === action[\s\S]*closeMenu\(!0\);\s*void this\.handleAction\(action\)\.catch/);
        expect(commandbar).toContain('id="jhs-fab" class="jhs-btn"');
        expect(commandbar).toContain('role="menuitem" class="jhs-btn jhs-fab-menu-item"');
        expect(commandbar).toContain('aria-expanded="false"');
        expect(commandbar).toMatch(/ArrowDown[\s\S]*ArrowUp[\s\S]*Home[\s\S]*End/);
        expect(settingPlugin).toMatch(/previousFocus[\s\S]*isConnected/);
        expect(settingPlugin).toMatch(/"Tab"[\s\S]*shiftKey/);
        expect(settings).toContain("完整设置");
    });

    it("binds full-settings layout ranges idempotently after loading the form", () => {
        expect(settingForms).toContain("bindLayoutRangeEvents(root, dependencies.busImg, dependencies.host, dependencies.settings);");
        expect(settingForms).toContain('.off(".jhsSetting")');
        expect(settingForms).toContain('.on("input.jhsSetting"');
        expect(settingForms).not.toContain('.on("change.jhsSetting"');
        expect(settingForms).not.toContain('settings.set("containerColumns"');
        expect(settingForms).not.toContain('settings.set("containerWidth"');
        expect(settingPlugin).toContain('selector: "#containerColumns"');
        expect(settingPlugin).toContain('selector: "#containerWidth"');
        const rangeBinding = settingForms.slice(settingForms.indexOf("function bindLayoutRangeEvents"), settingForms.indexOf("async function initQuickSettingForm"));
        expect(rangeBinding).not.toContain("saveSettingItem");
        const quickForm = settingForms.slice(settingForms.indexOf("async function initQuickSettingForm"));
        expect(quickForm).not.toContain('$("#containerColumns").on("input"');
        expect(quickForm).not.toContain('$("#containerWidth").on("input"');
    });

    it("uses semantic review and related layouts with safe external text", () => {
        expect(reviews).toContain("jhs-review-item");
        expect(reviewUi).toContain("document.createTextNode");
        expect(reviewUi).toContain("appendLink");
        expect(reviews).not.toContain("item columns is-desktop");
        expect(reviews).not.toContain("jhs-layout-");
        expect(related).toContain("jhs-related-item");
        expect(relatedUi).toContain("encodeURIComponent(item.id)");
        expect(related).not.toContain("item columns is-desktop");
        expect(related).not.toContain("jhs-layout-");
        expect(reviews).toMatch(/jhs-review-content[^}]*font-size:16px[^}]*line-height:1\.7/);
        expect(reviews).not.toMatch(/jhs-review-content[^}]*max-width/);
        expect(related).toContain("jhs-related-heading");
        expect(relatedUi).not.toMatch(/\.html\(/);
    });

    it("keeps 123 auth sync separate from its Integration API boundary", () => {
        expect(reviewUi).toContain('jhs-review-offline-btn jhs-offline-btn');
        expect(oneTwoThreeOffline).toContain("startTokenSync(scope)");
        expect(oneTwoThreeOffline).not.toContain("gmHttp");
        expect(oneTwoThreeOffline).not.toContain("offline_download/task");
        expect(pan123Integration).toContain('capabilities: ["offline.resolve", "offline.submit"]');
        expect(pan123Integration).toContain("async submit(resource, context = {})");
        expect(oneTwoThreeOffline).not.toContain("markCurrentVideoAsHasDown");
    });

    it("keeps external-site compatibility caches behind StorageService", () => {
        expect(otherSite).not.toContain("localStorage.");
        expect(otherSite).not.toContain("gmHttp");
        expect(otherSite).not.toContain('getRuntimeService("http")');
        expect(otherSite).toContain('getRuntimeService("movie").searchExternalSite');
        expect(otherSite).toContain('getRuntimeService("movie").externalSites');
        expect(otherSite).toContain('getLocal("jhs_enabled_sites")');
        expect(otherSite).toContain('setLocal("jhs_enabled_sites"');
        expect(otherSite).toContain("const latestRaw = storage.getLocal(a)");
    });

    it("routes magnet source requests through scoped HttpService", () => {
        expect(magnetHub).not.toContain("gmHttp");
        expect(magnetHub).toContain('getRuntimeService("http").request');
        expect(magnetHub).toContain('getRuntimeService("scope")');
        expect(magnetHub).toContain('trustClass: "custom-public"');
        expect(magnetHub).toContain('trustClass: "builtin-public"');
    });

    it("routes Xunlei subtitle work through normalized service contracts", () => {
        expect(detailButtons).not.toContain("gmHttp");
        expect(detailButtons).not.toContain("api-shoulei-ssl.xunlei.com");
        expect(detailButtons).toContain('getRuntimeService("subtitle")');
        expect(detailButtons).toContain('subtitle.search("xunlei"');
        expect(detailButtons).toContain('subtitle.download("xunlei"');
        expect(detailButtons).toContain("escapeHtml(e)");
    });

    it("routes JavDB login through AccountService without Feature credentials in URLs", () => {
        expect(top250).not.toContain("gmHttp");
        expect(top250).not.toContain("/v1/sessions");
        expect(top250).not.toContain("device_uuid");
        expect(top250).toContain('account.login("javdb"');
    });

    it("uses an explicit unknown category without conflating it with all", () => {
        const flatList = newVideo.slice(newVideo.indexOf("async getNewVideoFlatList"), newVideo.indexOf("async loadCoverForItems"));
        expect(flatList).toContain('category = $("#nvCategoryFilter").val() || "all"');
        expect(flatList).toContain('"unknown" === category ? 0 === item.categories.length');
    });

    it("keeps NewVideo module import free of local storage side effects", () => {
        expect(newVideo).not.toContain("localStorage.");
        expect(newVideo).not.toContain("gmHttp");
        expect(newVideo).toContain('getRuntimeService("actressInfo").movies');
        expect(newVideo).toContain('getRuntimeService("actressInfo").uncollect');
        expect(newVideo).toContain("initializeLocalState()");
        expect(newVideo).toContain('getLocal("jhs_newVideoViewMode")');
        expect(newVideo).toContain('setLocal("jhs_newVideoViewMode", mode)');
        expect(newVideo).toContain('setLocal(AVATAR_SOURCE_INDEX_KEY, n.toString())');
        expect(newVideo).toContain('getRuntimeService("actressInfo").searchAvatars');
    });

    it("uses semantic keyboard popovers and stable sort storage", () => {
        expect(listButtons).toContain('role="menuitemradio"');
        expect(listButtons).toContain('getRuntimeService("settings").set("sortMethod"');
        for (const key of [ "ArrowDown", "ArrowUp", "Home", "End", "Escape" ]) expect(listButtons).toContain(key);
        expect(listButtons).not.toMatch(/<select[^>]+sort-toggle-btn/);
        expect(coverButtons).toContain("width:152px");
        expect(coverButtons).toContain("jhs-card-menu__dot");
        expect(coverButtons).not.toMatch(/elastic|jelly|right:\s*-/);
    });

    it("keeps DMM preview persistence behind StorageService and SettingsService", () => {
        const previewService = readTestFile(join(process.cwd(), "src/services/preview-service.js"), "utf8");
        expect(previewVideo).not.toContain("localStorage.");
        expect(previewVideo).not.toContain("gmHttp");
        expect(previewVideo).not.toContain("api.dmm.com");
        expect(previewService).toContain('this.movie.preview("dmm"');
        expect(previewService).not.toContain("localStorage.");
        expect(previewVideo).toContain('this.getRuntimeService("storage")');
        expect(previewVideo).toContain('this.getRuntimeService("settings")');
        expect(previewVideo).toContain('settings.set("videoMuted"');
    });

    it("tests resource sources through scoped HttpService trust classes", () => {
        const start = settingPlugin.indexOf("async testSource"), testSource = settingPlugin.slice(start, settingPlugin.indexOf("previewCarNumbers", start));
        expect(testSource).toContain('getRuntimeService("http").request');
        expect(testSource).toContain('getRuntimeService("scope")');
        expect(testSource).toContain('trustClass: "custom-public"');
        expect(testSource).toContain('trustClass: "builtin-public"');
        expect(testSource).not.toContain("gmHttp");
    });

    it("defers core CSS side effects to Bootstrap and injects them once", () => {
        expect(injection).toContain("export function injectCoreCss()");
        expect(injection).toMatch(/export function injectCoreCss\(\) \{[\s\S]*H\(buildThemeCss\(\)\)[\s\S]*H\(buildUiPrimitivesCss\(\)\)/);
        expect(bootstrap).toContain('import { injectCoreCss } from "../core/css-injection.js"');
        expect(bootstrap).toContain("injectCoreCss();");
    });

    it("resets host cover animation without touching hover preview lifecycle", () => {
        expect(injection).toMatch(/\.movie-list \.item \.cover img[\s\S]*transform:none!important[\s\S]*transition:none!important/);
        expect(injection).not.toMatch(/scale\(1\.04\)|\.masonry \.item:hover/);
    });
});
