import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const repoRoot = join(import.meta.dirname, "..");
const srcRoot = join(repoRoot, "src");
const failures = [];

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) failures.push(message);
}

function forbidMatch(source, pattern, message) {
  if (pattern.test(source)) failures.push(message);
}

async function listJavaScriptFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listJavaScriptFiles(path));
    else if (extname(entry.name) === ".js") files.push(path);
  }
  return files;
}

const [theme, primitives, build, injection, magnet, settings, utils, detail, commandbar, newVideo, manager, hitShow, translate, settingStyles, main, packageSource, logger, reviews, related, settingPanels, settingForms, listButtons, coverButtons, highlightMagnet, task, storageQueue, constants, previewVideo, screenshot, parsers, otherSite, builtSource] = await Promise.all([
  readFile(join(srcRoot, "core", "theme.js"), "utf8"),
  readFile(join(srcRoot, "core", "ui-primitives.js"), "utf8"),
  readFile(join(repoRoot, "scripts", "build.mjs"), "utf8"),
  readFile(join(srcRoot, "core", "css-injection.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "external-search", "magnet-hub.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "backup", "setting-templates.js"), "utf8"),
  readFile(join(srcRoot, "core", "utils.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "status", "detail-workspace.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "status", "mobile-bottom-bar.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "new-video", "new-video.js"), "utf8"),
  readFile(join(srcRoot, "core", "plugin-manager.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "external-search", "hit-show.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "translate", "translate.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "backup", "setting-styles.js"), "utf8"),
  readFile(join(srcRoot, "main.js"), "utf8"),
  readFile(join(repoRoot, "package.json"), "utf8"),
  readFile(join(srcRoot, "core", "logger.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "external-search", "review.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "external-search", "related.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "backup", "setting-panels.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "backup", "setting-forms.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "status", "list-page-button.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "image-viewer", "cover-button.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "status", "highlight-magnet.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "new-video", "task.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "external-search", "other-site.js"), "utf8"),
  readFile(join(srcRoot, "core", "constants.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "image-viewer", "preview-video.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "image-viewer", "screenshot.js"), "utf8"),
  readFile(join(srcRoot, "parsers", "third-party-parsers.js"), "utf8"),
  readFile(join(srcRoot, "plugins", "external-search", "other-site.js"), "utf8"),
  readFile(join(repoRoot, "JHS.user.js"), "utf8")
]);

requireMatch(main, /^\/\/ @version\s+6\.4\.1$/m, "userscript version must be frozen at 6.4.1");
requireMatch(packageSource, /"version"\s*:\s*"6\.4\.1"/, "package version must be frozen at 6.4.1");

for (const token of [
  "--jhs-space-1", "--jhs-space-6", "--jhs-radius-xs", "--jhs-radius-pill",
  "--jhs-control-height", "--jhs-touch-target", "--jhs-motion-fast", "--jhs-motion-base",
  "--jhs-danger", "--jhs-danger-tint", "--jhs-warning", "--jhs-warning-tint"
]) requireMatch(theme, new RegExp(`${token}:`), `theme.js missing ${token}`);

for (const selector of [
  ".jhs-btn", ".jhs-field", ".jhs-switch", ".jhs-badge", ".jhs-chip",
  ".jhs-toolbar", ".jhs-section", ".jhs-setting-group", ".jhs-card",
  ".jhs-segmented", ".jhs-pagination", ".jhs-state"
]) requireMatch(primitives, new RegExp(selector.replace(".", "\\.")), `UI primitives missing ${selector}`);

for (const state of [":hover", ":focus-visible", ":disabled", "prefers-reduced-motion", "--jhs-touch-target"])
  requireMatch(primitives, new RegExp(state.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `UI primitives missing ${state}`);
for (const token of ["class JhsSelect", "menuitemradio", "OPTGROUP", "ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape", "Tab", "setValue", "setVisible", "refresh"])
  requireMatch(primitives, new RegExp(token), `JhsSelect missing ${token}`);
requireMatch(primitives, /\.jhs-segmented__item[^}]*\{[^}]*display:\s*inline-flex[^}]*align-items:\s*center[^}]*justify-content:\s*center[^}]*line-height:\s*1/, "segmented items must be centered on both axes");
requireMatch(theme, /\.layui-layer-close[\s\S]*::before[\s\S]*::after/, "layer close control must draw its own themed BasePlugin");

const themeIndex = build.indexOf('"theme.js"');
const primitivesIndex = build.indexOf('"ui-primitives.js"');
if (themeIndex < 0 || primitivesIndex < 0 || primitivesIndex < themeIndex)
  failures.push("ui-primitives.js must be bundled after theme.js");
requireMatch(injection, /H\(buildUiPrimitivesCss\(\)\)/, "shared UI CSS is not injected");
requireMatch(injection, /initializeUiAccessibility\(\)/, "dynamic UI accessibility enhancer is not initialized");
requireMatch(injection, /H\(F\)/, "clean global support CSS must be injected");
forbidMatch(injection, /cleanGlobalCss/, "legacy regex CSS cleanup layer must be deleted");

requireMatch(magnet, /role="tablist"/, "magnet source switcher missing tablist semantics");
requireMatch(magnet, /role="tab"/, "magnet source buttons missing tab semantics");
requireMatch(magnet, /aria-selected/, "magnet source buttons missing selected state");
requireMatch(magnet, /ArrowLeft.*ArrowRight.*Home.*End/s, "magnet source switcher missing arrow-key navigation");
requireMatch(settings, /<nav class="jhs-mobile-sidebar/, "settings navigation must use a nav landmark");
requireMatch(settings, /<button type="button" class="[^"]*side-menu-item/, "settings navigation items must be keyboard-native buttons");
forbidMatch(settings, /organizeSettingDialog/, "settings must emit final sections without runtime re-wrapping");
for (const token of ["jhs-setting-section", "jhs-setting-group", "jhs-setting-row__description"])
  requireMatch(settings, new RegExp(token), `settings information architecture missing ${token}`);

for (const preset of ["sm", "md", "lg", "xl", "workspace"])
  requireMatch(utils, new RegExp(`${preset}:\\s*\\[`), `dialog preset missing ${preset}`);
requireMatch(utils, /window\.innerWidth\s*<=\s*768\s*\?\s*16/, "mobile dialog inset must be 16px");
requireMatch(utils, /getResponsiveArea\(e\)/, "legacy responsive dialog API must remain available");

for (const section of ["summary", "gallery", "resources", "related", "reviews"])
  requireMatch(detail, new RegExp(`data-jhs-section=\\"\\$\\{name\\}\\"|section\\(\\"${section}\\"`), `detail workspace missing ${section}`);
requireMatch(detail, /if \(!window\.isDetailPage\) return/, "detail workspace must be limited to detail pages");
requireMatch(commandbar, /id="jhs-page-commandbar"/, "page command bar is missing");
if ((commandbar.match(/id="jhs-page-commandbar"/g) || []).length !== 1) failures.push("page command bar must have one source template");
requireMatch(commandbar, /ArrowDown.*ArrowUp.*Home.*End/s, "batch menu missing keyboard navigation");
requireMatch(manager, /afterPluginsReady/, "plugin manager missing afterPluginsReady lifecycle");
requireMatch(commandbar, /afterPluginsReady\(\)[\s\S]*buildCommandBar/, "command bar must assemble after plugins are ready");
requireMatch(commandbar, /quickFilter\.length[\s\S]{0,180}jhs-commandbar__filters/, "command bar must move the complete quick-filter control when present");
requireMatch(commandbar, /jhs-mobile-filter-menu[\s\S]*jhs-mobile-filter-option/, "mobile list filtering must remain available outside the hidden command bar");
forbidMatch(commandbar, /\.jhs-commandbar__filters\s*\{[^}]*overflow-x\s*:\s*auto/, "command bar filters must not clip popovers");
forbidMatch(commandbar, /@media \(max-width:\s*1023px\)[\s\S]*?\.jhs-page-commandbar\s*\{[^}]*overflow-x\s*:\s*auto/, "tablet command bar must wrap instead of scroll");
requireMatch(commandbar, /@media \(max-width:\s*1023px\)[\s\S]*?\.jhs-page-commandbar\s*\{[^}]*flex-wrap:\s*wrap[^}]*overflow:\s*visible/, "tablet command bar must wrap with visible popovers");
requireMatch(commandbar, /@media \(max-width:\s*768px\)[\s\S]*?\.jhs-page-commandbar\s*\{[^}]*display:\s*none/, "mobile command bar must stay hidden");
forbidMatch(commandbar, /\$\("#waitCheckBtn"\)\.click\(\)/, "mobile identification must call its business API directly");
requireMatch(commandbar, /\[ "#waitCheckBtn", "#newVideoBtn", "#historyBtn" \]/, "command bar must expose exactly the three primary entries");
requireMatch(commandbar, /\[ "#statsBtn", "#blacklistBtn" \][\s\S]*jhs-commandbar__menu/, "statistics and blacklist must be grouped in more menu");
requireMatch(commandbar, /#addBlacklistBtn[\s\S]*jhs-commandbar__context/, "actor context action must remain directly visible");
requireMatch(commandbar, /#filterAllVideo[\s\S]*#favoriteAllVideo[\s\S]*#hasDownAllVideo/, "batch menu must contain exactly the three bulk actions");
requireMatch(hitShow, /async handle\(\)[\s\S]*await this\.handlePlayback/, "hit show handle must await its data flow");
requireMatch(hitShow, /jhs-hitshow-heading/, "hit show title and period must share a dedicated heading row");
requireMatch(hitShow, /class="jhs-segmented__item \$\{[^}]+\? "active"/, "hit show period must use the active class");
requireMatch(hitShow, /aria-selected="\$\{[^}]+\? "true" : "false"\}"/, "hit show period must expose aria-selected");
forbidMatch(hitShow, /is-active|aria-current/, "hit show period must not retain legacy selected state");
for (const field of ["data-jhs-rate-count", "data-jhs-publish-time", "data-original-index"])
  requireMatch(hitShow, new RegExp(field), `hit show sorting field missing ${field}`);
forbidMatch(hitShow, /tool-box|button is-small/, "hit show must use the shared segmented toolbar");
requireMatch(translate, /const s = "string" == typeof e \? e\.trim\(\) : "", o = s && "undefined" !== s \? s : a/, "translation cache key needs a safe title fallback");
requireMatch(translate, /nextAll\("\.translated-title"\)/, "translation output must update an existing node");
forbidMatch(translate, /translated-title[\s\S]{0,300}\.html\(/, "translated external text must not use html()");
forbidMatch(settingStyles, /mini-switch:checked[\s\S]{0,120}status-down/, "ordinary switches must use the accent color");
forbidMatch(settingStyles, /right:\s*-300%/, "quick settings must be anchored to its trigger");
forbidMatch(settingStyles, /\.form-content\s+\*/, "legacy form-content wildcard must not resize nested controls");
forbidMatch(settingStyles, /min-height:\s*180px/, "empty settings output must not reserve a 180px box");
requireMatch(settings, /<details class="jhs-diagnostics">/, "plugin diagnostics must be collapsed by default");
requireMatch(settings, /class="simple-setting__list"/, "quick settings must use its dedicated compact list");
forbidMatch(settings, /helpBtn|\(\?\)|tooltip-icon/, "quick settings help and question-mark hints must be fully removed");
forbidMatch(settingForms, /help-container|常见问题|使用说明|helpBtn/, "settings help implementation must be fully removed");
requireMatch(settings, /id="moreBtn" class="jhs-btn jhs-btn--ghost"/, "quick settings footer must only retain the ghost more-settings action");
requireMatch(settingPanels, /html \+= `<\/section>`/, "plugin groups must close with section");
requireMatch(logger, /document\.addEventListener\("mouseover", this\.onDocumentOver\)/, "image preview must use delegated target handling");
requireMatch(logger, /document\.removeEventListener\("mouseover", this\.onDocumentOver\)/, "image preview must remove delegated listeners");
requireMatch(logger, /currentUrl = null[\s\S]*loadedUrls = new Map/, "image preview must cache loaded URLs");
requireMatch(logger, /hideDelay:\s*100/, "image preview must debounce hiding for 100ms");
requireMatch(logger, /\.image-hover-preview\s*\{[^}]*display:\s*block[^}]*visibility:\s*hidden/, "image preview must remain mounted while hidden");
forbidMatch(logger, /\.image-hover-preview\s*\{[^}]*display:\s*none/, "image preview must not animate with display none");
forbidMatch(logger, /boundElements/, "image preview must not retain rendered elements");
requireMatch(logger, /this\.placement = this\.choosePlacement/, "image preview must lock one viewport placement per hover");
forbidMatch(detail, /observer\.observe\(document\.body/, "detail workspace must not observe the entire document body");
requireMatch(detail, /controller\.find\("#magnets-content"\)/, "JavDB resource adapter must preserve the magnet controller boundary");
requireMatch(detail, /data-jhs-slot="summary-actions"[\s\S]*data-jhs-slot="reviews"[\s\S]*data-jhs-slot="related"/, "host workspace must expose summary actions and reviews-before-related post-resource slots");
requireMatch(detail, /observer\.observe\(adapter\.observeRoot\[0\]/, "detail resource lifecycle must stay scoped to the resource observe root");
forbidMatch(detail, /\.jhs-detail-host-workspace\s*\{[^}]*display\s*:\s*flex|data-jhs-host-region[^}]*order\s*:/, "host details must not be converted to an ordered flex layout");
forbidMatch(detail, /routeSections|moveToSection|movePanelToSection/, "detail workspace must not continuously remount panels");
for (const [source, label] of [[reviews, "reviews"], [related, "related lists"]]) {
  forbidMatch(source, /item columns is-desktop|jhs-layout-[a-f0-9]{8}/, `${label} must not reuse host or migration layout classes`);
}
requireMatch(reviews, /document\.createTextNode/, "review external content must be rendered as text nodes");
requireMatch(reviews, /appendLinkControls/, "review links must use compact semantic controls");
requireMatch(reviews, /font-size:15px[\s\S]*font-weight:600/, "review author must use 15px semibold text");
requireMatch(reviews, /jhs-review-content[^}]*font-size:16px[^}]*line-height:1\.7/, "review body readability contract is missing");
forbidMatch(reviews, /jhs-review-content[^}]*max-width/, "review body must use the full available width");
requireMatch(related, /jhs-related-heading[\s\S]*jhs-related-meta/, "related lists must use one-column heading and metadata structure");
requireMatch(detail, /normalizeHostActions\(root\.find\("\.video-meta-panel"\)\.first\(\)\)/, "JavDB host action normalization must stay scoped to its info container");
requireMatch(detail, /jhs-detail-host-action/, "detail workspace host action appearance class is missing");

requireMatch(listButtons, /role="menuitemradio"/, "sort control must use menuitemradio options");
requireMatch(listButtons, /jhs_sortMethod/, "sort control must retain its storage key");
for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Escape"])
  requireMatch(listButtons, new RegExp(key), `sort control is missing ${key} keyboard behavior`);
forbidMatch(listButtons, /<select[^>]+sort-toggle-btn/, "native sort select must not return");
requireMatch(coverButtons, /width:152px/, "card menus must use the anchored 152px popover");
requireMatch(coverButtons, /jhs-card-menu__dot[^}]*width:8px/, "card status menu must use 8px state dots");
for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Escape"])
  requireMatch(coverButtons, new RegExp(key), `card menus are missing ${key} keyboard behavior`);
forbidMatch(coverButtons, /elastic|jelly|right:\s*-/, "card menus must not use bounce animation or negative offsets");
requireMatch(injection, /\.movie-list \.item \.cover img[\s\S]*transform:none!important[\s\S]*transition:none!important/, "JavDB cover reset is missing");
forbidMatch(injection, /scale\(1\.04\)|\.masonry \.item:hover/, "JavBus cover hover effects must remain removed");

requireMatch(magnet, /class="magnet-copy"[\s\S]*copy-btn[\s\S]*jhs-offline-btn/, "resource row must directly contain copy and unified offline buttons");
forbidMatch(magnet, /magnet-(?:more|overflow)|more-menu/, "resource row must not hide actions in a more menu");
requireMatch(newVideo, /repeat\(auto-fit,minmax\(min\(100%,260px\),1fr\)\)/, "new video cards must use the adaptive 260px grid");
requireMatch(newVideo, /\.newVideoToolBox\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0[^}]*box-sizing:\s*border-box/, "new video workspace must contain its own width");
requireMatch(newVideo, /#actress-card-container\s*\{[^}]*min-width:\s*0[^}]*box-sizing:\s*border-box[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto/, "actress card container must prevent horizontal overflow without disabling vertical scrolling");
requireMatch(newVideo, /#new-video-list-container\s*\{[^}]*min-width:\s*0[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto/, "new video list container must prevent horizontal overflow without disabling vertical scrolling");
requireMatch(newVideo, /\.jhs-new-video-grid\s*\{[^}]*repeat\(auto-fill,minmax\(min\(100%,260px\),1fr\)\)[^}]*width:\s*100%[^}]*min-width:\s*0[^}]*box-sizing:\s*border-box/, "new video list grid must fit narrow containers");
forbidMatch(newVideo, /\.layui-layer[^}]*overflow-x\s*:\s*hidden/, "new video overflow fixes must not mask the issue at the layui layer");
requireMatch(newVideo, /actress-card-avatar[\s\S]{0,180}border-radius:\s*50%/, "new video avatars must use a defined round radius");
requireMatch(newVideo, />重新检测</, "new video card must keep the text primary action");
requireMatch(newVideo, /type:\s*"error"[\s\S]{0,240}actionLabel:\s*"重试"/, "new video load failure must expose a retry action");
requireMatch(newVideo, /const profileUrl = normalizeHttpUrl\(`\/actors\/\$\{encodeURIComponent\(starId\)\}\?t=d`, javDbUrl\)/, "actress profile URL must normalize the initialized JavDB URL and encode the actor ID");
requireMatch(newVideo, /noteText = isPaused/, "actress note text must not shadow the JavDB URL");
const builtCardStart = builtSource.indexOf("async renderActressCards()");
const builtCardEnd = builtSource.indexOf("async getNewVideoFlatList()", builtCardStart);
const builtCardSource = builtCardStart >= 0 && builtCardEnd > builtCardStart ? builtSource.slice(builtCardStart, builtCardEnd) : "";
requireMatch(builtCardSource, /normalizeHttpUrl\(`\/actors\/\$\{encodeURIComponent\(\w+\)\}\?t=d`,\s*\w+\)/, "built actress cards are missing their normalized JavDB profile URL");
forbidMatch(builtCardSource, /\w+=`\$\{(\w+)\}\/actors\/\$\{\w+\.starId\}\?t=d`[\s\S]{0,1000}\b(?:const|let)\b[^;]*\b\1=/,
  "built actress cards read a shadowed variable before initialization");
requireMatch(constants, /function normalizeCarNum[\s\S]*\[ "undefined", "null" \]/, "shared car number normalization is missing");
requireMatch(manager, /params\.get\("jhsCarNum"\)[\s\S]*copyCarNum[\s\S]*panelCarNum[\s\S]*fallbackCarNum/, "detail car number priority is incomplete");
requireMatch(constants, /function assertPageInfoContract[\s\S]*expected object/, "getPageInfo development contract assertion is missing");
requireMatch(manager, /return assertPageInfoContract\(\{\s*carNum,\s*url: t,\s*actress: n,\s*actors: a,\s*publishTime: i\s*\}\)/,
  "getPageInfo must return its complete public object contract");
requireMatch(utils, /new URL\(e, window\.location\.origin\)[\s\S]*searchParams\.set\("jhsCarNum", carNum\)/, "detail URLs must carry the known car number");
requireMatch(previewVideo, /async fetchVideo\(\)\s*\{\s*const carNum = normalizeCarNum\(this\.carNum\)/, "DMM must validate carNum before cache and parsing");
requireMatch(previewVideo, /跳过 DMM 解析：番号不可用/, "DMM invalid-number warning is missing");
requireMatch(previewVideo, /<video id="jhs-preview-video"[^>]+controls playsinline/, "JavDB DMM playback must use an isolated JHS video element");
requireMatch(previewVideo, /nativeVideo\.pause\(\)[\s\S]{0,100}jhs-native-preview-hidden/, "successful DMM playback must pause and hide the JavDB player");
requireMatch(previewVideo, /dmmVideo\.muted = !muted \|\| "yes" === muted/, "JavDB DMM playback must default to muted autoplay");
requireMatch(previewVideo, /addClass\("is-active"\)[\s\S]{0,300}高画质预览静音重试[\s\S]{0,300}restoreNativePlayer/, "JavDB DMM playback must be visible and retry muted before native fallback");
forbidMatch(previewVideo, /nativePreviewSrc|rememberNativeSource|restoreNativeSource|video\.currentSrc/, "JavDB HLS blob sources must never be cached or restored");
forbidMatch(previewVideo, /\$nativeVideo\.attr\("src"|nativeVideo\.load\(\)/, "JHS must not replace or reload the JavDB HLS media source");
requireMatch(screenshot, /async getScreenshot\(e\)\s*\{\s*e = normalizeCarNum\(e\)/, "screenshots must validate carNum first");
requireMatch(screenshot, /无法获取番号，缩略图未加载/, "screenshot invalid-number fallback is missing");
requireMatch(screenshot, /javstore\.net\/search\?q=\$\{encodeURIComponent\(e\)\}/, "JavStore must use its query search endpoint");
requireMatch(parsers, /a\[href\$=["']-pn\.html["']\][\s\S]{0,240}includes\(normalizedCarNum\.toUpperCase\(\)\)[\s\S]{0,180}\.map\([\s\S]{0,120}\.get\(\)/,
  "JavStore must preserve all matching -pn.html results in source order");
requireMatch(screenshot, /for \(const e of i\)[\s\S]*gmHttp\.get\(t/, "JavStore detail URLs must be checked sequentially");
requireMatch(parsers, /normalizeJavStoreAssetUrl\(previewHref, detailUrl\)/, "JavStore preview URLs must be resolved and normalized against the detail page");
requireMatch(parsers, /"javstore\.net" === hostname \|\| hostname\.endsWith\("\.javstore\.net"\)[\s\S]{0,100}url\.protocol = "https:"/, "JavStore HTTP preview URLs must be upgraded selectively");
requireMatch(parsers, /previewUrl\.replace\("\.th", ""\)/, "JavStore preview URLs must retain .th compatibility");
requireMatch(screenshot, /"javstore" === provider \? normalizeJavStoreAssetUrl\(cachedUrl\) : cachedUrl/, "legacy JavStore screenshot cache reads must normalize asset URLs");
requireMatch(screenshot, /addImg\(e, t\)[\s\S]{0,100}normalizeJavStoreAssetUrl\(t\)/, "screenshot rendering must normalize JavStore asset URLs at the final boundary");
requireMatch(parsers, /"CLICK HERE!" === \$\(element\)\.text\(\)\.trim\(\)/, "JavStore detail parsing must retain the CLICK HERE! link contract");
requireMatch(screenshot, /详情页没有 CLICK HERE![\s\S]{0,80}continue/, "JavStore must continue after a candidate without CLICK HERE!");
forbidMatch(screenshot, /javstore\.net\/search\/|img\[src\*=['"]_s\.jpg/, "legacy JavStore search or detail fallback must not return");
requireMatch(otherSite, /跳过第三方站点解析：番号不可用/, "external sites must fail fast without a car number");
for (const entry of ["checkNewVideo", "checkFavoriteActress", "checkOneNewVideo"])
  requireMatch(task, new RegExp(`async ${entry}\\([^)]*\\)\\s*\\{\\s*await this\\.ensureReady\\(\\)`), `${entry} must initialize itself`);
for (const field of ["success", "parseFailed", "networkFailed", "skippedStopped", "skippedInterval", "aborted"])
  requireMatch(task, new RegExp(field), `new video result missing ${field}`);
requireMatch(task, /parsePage\(e, site,/, "new video parsing must receive an explicit site");
forbidMatch(task, /includes\(["']javdb["']\)/, "new video parsing must not infer the site from HTML text");
requireMatch(task, /"valid" !== pageState\.state[\s\S]{0,120}throw/, "missing movie containers must fail parsing");
requireMatch(task, /0 === s\.length[\s\S]{0,220}newVideoList:\s*\[\]/, "valid empty movie containers must persist an empty result");
requireMatch(storageQueue, /return this\.queue = task\.catch[\s\S]{0,160}, task/, "storage queue must reject callers and recover its internal chain");
forbidMatch(highlightMagnet, /#enable-magnets-filter[^\n]{0,100}(?:hide\(|addClass\(["']do-hide)/, "magnet filtering must never hide its toolbar entry");
requireMatch(highlightMagnet, /removeClass\("do-hide"\)[\s\S]{0,160}未识别到可过滤项/, "magnet filtering must retain a no-match hint");
requireMatch(highlightMagnet, /showAll\(\)[\s\S]{0,260}removeClass\("do-hide"\)[\s\S]{0,260}\.show\(\)/, "disabling magnet filtering must restore every row");
requireMatch(detail, /#enable-magnets-filter/, "FC2 detail workspace must collect the magnet filter action");
requireMatch(detail, /container\.append\(summary, gallery, resources, reviews, related\)/, "FC2 workspace must place reviews before related lists");
requireMatch(commandbar, /<button type="button" id="jhs-fab" class="jhs-btn"/, "mobile FAB must be a native JHS button");
requireMatch(commandbar, /role="menuitem" class="jhs-btn jhs-fab-menu-item"/, "mobile FAB items must use native menu buttons");
requireMatch(commandbar, /ArrowDown[\s\S]*ArrowUp[\s\S]*Home[\s\S]*End/, "mobile FAB menu must support keyboard navigation");
const settingPlugin = await readFile(join(srcRoot, "plugins", "backup", "setting.js"), "utf8");
requireMatch(settingPlugin, /previousFocus[\s\S]*isConnected[\s\S]*previousFocus\.focus/, "quick settings must restore its opener focus");
requireMatch(settingPlugin, /"Tab"[\s\S]*focusable[\s\S]*shiftKey/, "quick settings must trap focus in both directions");

const sourceFiles = await listJavaScriptFiles(srcRoot);
const zIndexBody = theme.match(/const JHS_Z_INDEX = Object\.freeze\(\{([\s\S]*?)\}\);/)?.[1] || "";
const zIndexKeys = new Set([...zIndexBody.matchAll(/^\s*([A-Za-z][\w]*)\s*:/gm)].map((match => match[1])));
const toKebab = value => value.replace(/[A-Z]/g, (letter => `-${letter.toLowerCase()}`));
for (const key of zIndexKeys) requireMatch(theme, new RegExp(`--jhs-z-${toKebab(key)}\\s*:`), `z-index constant ${key} is missing its CSS token`);
let inlineStyleCount = 0;
let selectCount = 0;
for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  const count = source.match(/\sstyle\s*=\s*["'`]/g)?.length ?? 0;
  inlineStyleCount += count;
  const path = relative(repoRoot, file).replaceAll("\\", "/");
  const selects = source.match(/<select\b[^>]*>/g) || [];
  selectCount += selects.length;
  for (const select of selects) if (!/\bjhs-select-source\b/.test(select)) failures.push(`${path} contains an unenhanced select`);
  for (const input of source.match(/<input\b[^>]*>/g) || []) {
    if (/(?:type=["'](?:text|url|password|number)["']|<input(?![^>]*\btype=))/i.test(input) && !/\bjhs-field\b/.test(input)) failures.push(`${path} contains a naked text input`);
  }
  for (const textarea of source.match(/<textarea\b[^>]*>/g) || []) if (!/\bjhs-textarea\b/.test(textarea)) failures.push(`${path} contains a naked textarea`);
  for (const button of source.match(/<button\b[^>]*>/g) || []) if (!/\bjhs-btn\b/.test(button)) failures.push(`${path} contains an operation button without jhs-btn`);
  for (const rule of source.match(/\.jhs-layout-[a-f0-9]{8}\s*\{[^}]*\}/g) || [])
    if (/\b(?:color|background(?:-color)?|border(?:-[\w-]+)?|font(?:-[\w-]+)?|box-shadow|text-shadow|opacity|filter|transition)\s*:/.test(rule)) failures.push(`${path} contains visual properties in a jhs-layout utility`);
  if (count > 0) failures.push(`${path} has ${count} forbidden static inline styles`);
  if (path !== "src/core/theme.js") forbidMatch(source, /rotate\(45deg\)|linear-gradient\(145deg/i,
    `${relative(repoRoot, file)} contains a banned ribbon or neumorphic treatment`);
  if (path !== "src/core/feature-helpers.js") forbidMatch(source, /\.play\s*\(/, `${path} contains a naked media play call`);
  if (path !== "src/core/utils.js") forbidMatch(source, /navigator\.clipboard|execCommand\s*\(\s*["']copy["']/, `${path} bypasses the clipboard helper`);
  if (path !== "src/core/logger.js" && path !== "src/main.js") forbidMatch(source, /\bconsole\.(?:log|warn|error)\s*\(/, `${path} bypasses clog`);
  for (const reference of source.matchAll(/JHS_Z_INDEX\.([A-Za-z][\w]*)/g)) if (!zIndexKeys.has(reference[1])) failures.push(`${path} references unknown z-index token ${reference[1]}`);
  forbidMatch(source, /\.then\(\s*\)/, `${path} contains an unobserved empty then call`);
  forbidMatch(source, /catch\s*\([^)]*\)\s*\{\s*\}/, `${path} contains an empty catch block`);
  if (path !== "src/core/utils.js") forbidMatch(source, /utils\.isMobile\(\)/, `${path} bypasses the mobile-mode setting`);
  if (path !== "src/core/theme.js") {
    forbidMatch(source, /z-index\s*:\s*-?\d/i, `${path} contains a numeric z-index`);
    forbidMatch(source, /\bzIndex\s*:\s*-?\d/i, `${path} contains a numeric zIndex`);
  }
  forbidMatch(source, /class\s*=\s*["'][^"']*\bjhs-btn\b[^"']*\s(?:button|is-(?:info|small|primary|success|danger|warning))(?:\s|["'])/i,
    `${path} mixes JHS and Bulma button classes`);
  if (["src/plugins/external-search/top250.js", "src/plugins/external-search/hit-show.js", "src/plugins/external-search/fc2.js", "src/plugins/status/list-page.js"].includes(path))
    forbidMatch(source, /class=["'][^"']*(?:\bbutton\b|\bbuttons\b|\btag\s+is-(?:primary|warning|success|info))/, `${path} contains legacy Bulma controls`);
  if (["src/plugins/external-search/top250.js", "src/plugins/external-search/hit-show.js"].includes(path))
    forbidMatch(source, /上一頁|下一頁|人評價/, `${path} contains traditional JHS UI copy`);
  forbidMatch(source, /id=["']conditionBox["']/, `${path} contains the duplicate Top250 condition id`);
  forbidMatch(source, /menu-btn|main-tab-btn|(?:class|removeClass|addClass|querySelector)[^\n]{0,80}a-(?:normal|primary|success|danger|warning|info)/,
    `${path} contains a forbidden legacy visual button class`);
  forbidMatch(source, /@keyframes\s+(?:elastic|jelly)|(?:menu|popover)[^}]{0,240}right:\s*-\d+px/,
    `${path} contains a forbidden bounce animation or negative menu offset`);
  forbidMatch(source, /(?:search|searchstr)[^\n]{0,80}undefined(?:\.html)?/i, `${path} can construct an undefined search URL`);
}
if (selectCount < 22) failures.push(`expected every JHS select to remain enhanced, found only ${selectCount}`);

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL: ${failure}`));
  process.exit(1);
}

console.log(`UI consistency audit passed: lifecycle, IA, sorting, translation, direct resource actions, keyboard states, ${inlineStyleCount} static inline styles`);
