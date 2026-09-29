import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const listPage = readTestFile(join(process.cwd(), "src/features/list/list-compatibility-service.js"), "utf8");
const listBatch = readTestFile(join(process.cwd(), "src/features/list/list-batch-controller.js"), "utf8");
const listButtons = readTestFile(join(process.cwd(), "src/features/list/list-actions-controller.js"), "utf8");
const listBatchUi = readTestFile(join(process.cwd(), "src/features/list/list-batch-ui.js"), "utf8");
const blacklist = readTestFile(join(process.cwd(), "src/compat/blacklist-compatibility-bean.js"), "utf8");
const scanner = readTestFile(join(process.cwd(), "src/features/list/batch-scanner.js"), "utf8");

describe("batch action contract (筛选后批量语义)", () => {
    it("scans every page from the first page through the shared scanner with the frozen filter snapshot", () => {
        expect(listBatch).toContain("scanAllPages({");
        expect(listBatch).toContain("startDom: root ? $(root) : $(this.document)");
        expect(listBatch).toContain('const isPageScopedList = isRankingPage || isExternalCatalog');
        expect(listBatch).toContain("currentUrl: isPageScopedList || root ? null : pageUrl");
        expect(listBatch).toContain('const firstPageUrl = isPageScopedList || root ? null : (this.hostAdapter?.resolveFirstPageUrl?.(pageUrl) ?? pageUrl)');
        expect(listBatch).toContain('maxPages: isPageScopedList ? 1 : 200');
        expect(listBatch).toContain('this.hostAdapter?.resolveFirstPageUrl?.(pageUrl) ?? pageUrl');
        expect(listBatch).toContain("itemSelector: selectors.requestDomItemSelector");
        expect(listBatch).toContain('evaluateListItem({ carNum: item.carNum, title: item.title || "" }, context, { filter: normalized })');
    });

    it("confirms with filter-aware copy for all and other filters", () => {
        expect(listBatch).toContain("将处理当前搜索全部分页的所有作品，包括屏蔽项。");
        expect(listBatch).toContain("将处理当前搜索全部分页中符合「");
        expect(blacklist).toContain("return this.batchAllVideos(name, options)");
    });

    it("writes in chunks through StateService.batch patch instead of per-item transactions", () => {
        expect(listBatch).toMatch(/index \+= 75[\s\S]{0,220}this\.state\.patch\(chunk\.map\(\(item\) => item\.carNum\)/);
        expect(listBatch).toContain('type: stateFlag === "blocked" ? "actor-page-block" : "actor-page-batch-state"');
        const compatibilityBatch = blacklist.slice(blacklist.indexOf("filterAllVideo(name"), blacklist.indexOf("\n}"));
        expect(compatibilityBatch).not.toContain("state").and.not.toContain("scanAllPages");
        expect(listBatch).not.toMatch(/for \(const element of items\)[\s\S]{0,200}state\.patch\(carNum/);
    });

    it("keeps the button entry points on the scope-based batch API with per-filter confirmation", () => {
        expect(listButtons).toContain("this.batchController.run(batchScope, flag)");
        expect(listButtons).toContain("this.list?.batchSaveAllVideos?.(batchScope, flag)");
        expect(listButtons).toContain("void this.runBatch(h)");
        expect(listButtons).toContain("void this.runBatch(g)");
        expect(listButtons).toContain("buildBatchScope()");
        expect(listButtons).toContain('const displayName = this.isOwnedRankingPage() ? "当前榜单页面" : this.isExternalFc2CatalogPage() ? "当前片库页面" : "当前搜索条件"');
        expect(listButtons).toContain('this.getBatchActionTip("favorite")');
        expect(listButtons).not.toContain("一键收藏所有可见作品?");
        expect(listButtons).toContain("批量屏蔽");
        expect(listButtons).toContain("批量收藏");
        expect(listButtons).toContain("批量标记已下载");
        expect(listButtons).not.toContain('utils.q(n, "一键屏蔽视频列表?"');
        expect(listPage).toContain("async batchSaveAllVideos(scope, flag, options = {})");
        expect(listPage).toContain("this.listBatchController.run(scope, flag, options)");
        expect(listBatchUi).toContain('cancel.title = "正在写入，无法取消"');
        expect(listBatch).toContain("this.ui.markWriting(progress)");
        expect(listPage).not.toContain("getBatchUiAdapter");
        expect(listPage).not.toContain("showBatchProgress");
        expect(listPage).not.toContain("setBatchButtonsDisabled");
        expect(listBatch).not.toContain("legacyPlugin");
        expect(listBatchUi).toContain("requestCancelBatchRun(run)");
        expect(listBatchUi).toContain('this.document.createElement("div")');
        expect(scanner).toContain("matchesCurrentFilter === true");
        expect(scanner).toContain("isSamePageUrl(firstPageUrl, currentUrl)");
    });

    it("runs every batch action through the shared Single Flight coordinator", () => {
        expect(listBatch).toContain("tryBeginBatchRun()");
        expect(listBatch).toContain("isActiveBatchRun(run)");
        expect(listBatch).toContain("endBatchRun(run)");
        expect(listBatch).toContain("已有批量任务正在执行");
        expect(listBatch).toContain("this.ui.setButtonsDisabled(true)");
        expect(listBatch).toContain("this.ui.setButtonsDisabled(false)");
        expect(listBatchUi).toContain('"#favoriteAllVideo, #hasDownAllVideo, #filterAllVideo"');
        const compatibilityBatch = blacklist.slice(blacklist.indexOf("filterAllVideo(name"), blacklist.indexOf("\n}"));
        expect(compatibilityBatch).not.toContain("tryBeginBatchRun");
        expect(compatibilityBatch).not.toContain("endBatchRun");
    });
});
