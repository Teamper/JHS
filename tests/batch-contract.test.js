import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const listPage = readTestFile(join(process.cwd(), "src/plugins/status/list-page.js"), "utf8");
const listButtons = readTestFile(join(process.cwd(), "src/plugins/status/list-page-button.js"), "utf8");
const blacklist = readTestFile(join(process.cwd(), "src/features/library/blacklist-controller.js"), "utf8");
const scanner = readTestFile(join(process.cwd(), "src/features/list/batch-scanner.js"), "utf8");

describe("batch action contract (筛选后批量语义)", () => {
    it("scans every page from the first page through the shared scanner with the frozen filter snapshot", () => {
        expect(listPage).toContain("scanAllPages({");
        expect(listPage).toContain("startDom: root ? $(root) : $(document)");
        expect(listPage).toContain("currentUrl: isOwnedRankingPage ? null : (root ? null : window.location.href)");
        expect(listPage).toContain('firstPageUrl: isOwnedRankingPage ? null : (root ? null : (this.getRuntimeService("host")?.resolveFirstPageUrl?.(window.location.href) ?? window.location.href))');
        expect(blacklist).toContain("firstPageUrl: root ? null : (this.hostAdapter?.resolveFirstPageUrl?.(this.getCurrentUrl()) ?? this.getCurrentUrl())");
        expect(listPage).toContain("itemSelector: this.getListSelectors().requestDomItemSelector");
        expect(listPage).toContain('evaluateListItem({ carNum: item.carNum, title: item.title || "" }, context, { filter: normalized })');
    });

    it("confirms with filter-aware copy for all and other filters", () => {
        expect(listPage).toContain("将处理当前搜索全部分页的所有作品，包括屏蔽项。");
        expect(listPage).toContain("将处理当前搜索全部分页中符合「");
        expect(blacklist).toContain("将处理当前搜索全部分页的所有作品（包括屏蔽项）并加入黑名单。");
    });

    it("writes in chunks through StateService.batch patch instead of per-item transactions", () => {
        expect(listPage).toMatch(/index \+= 75[\s\S]{0,220}state"\)\.patch\(chunk\.map\(\(item\) => item\.carNum\)/);
        expect(blacklist).toContain("for (let index = 0; index < records.length; index += 75)");
        expect(blacklist).toContain("this.state.patch(chunk.map((/** @type {BlacklistRecord} */ item) => item.carNum)");
        expect(listPage).not.toMatch(/for \(const element of items\)[\s\S]{0,200}state\.patch\(carNum/);
    });

    it("keeps the button entry points on the scope-based batch API with per-filter confirmation", () => {
        expect(listButtons).toContain("batchSaveAllVideos?.(scope, h)");
        expect(listButtons).toContain("batchSaveAllVideos?.(scope, g)");
        expect(listButtons).toContain("buildBatchScope()");
        expect(listButtons).toContain('{ kind: "search", displayName: "当前搜索条件", recordName: "" }');
        expect(listButtons).not.toContain("一键收藏所有可见作品?");
        expect(listButtons).toContain("批量屏蔽");
        expect(listButtons).toContain("批量收藏");
        expect(listButtons).toContain("批量标记已下载");
        expect(listButtons).not.toContain('utils.q(n, "一键屏蔽视频列表?"');
        expect(listPage).toContain("async batchSaveAllVideos(scope, flag");
        expect(listPage).toContain('正在写入，无法取消');
        expect(listPage).toContain('#jhs-batch-cancel").prop("disabled", true');
        expect(scanner).toContain("matchesCurrentFilter === true");
        expect(scanner).toContain("isSamePageUrl(firstPageUrl, currentUrl)");
    });

    it("runs every batch action through the shared Single Flight coordinator", () => {
        expect(listPage).toContain("tryBeginBatchRun()");
        expect(listPage).toContain("isActiveBatchRun(run)");
        expect(listPage).toContain("endBatchRun(run)");
        expect(listPage).toContain("已有批量任务正在执行");
        expect(listPage).toContain("setBatchButtonsDisabled(true)");
        expect(listPage).toContain("setBatchButtonsDisabled(false)");
        expect(blacklist).toContain("tryBeginBatchRun()");
        expect(blacklist).toContain("已有批量任务正在执行");
        expect(blacklist).toContain("if (isActiveBatchRun(run)) endBatchRun(run)");
    });
});
