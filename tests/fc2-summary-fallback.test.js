// @vitest-environment jsdom
import jquery from "jquery";
import { afterEach, expect, it, vi } from "vitest";
import { Fc2WorkspaceService } from "../src/features/detail/fc2-workspace-service.js";

const contexts = [];
afterEach(() => {
    contexts.splice(0).forEach(context => context.destroy());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
});

function fixture(initialMovie = { title: "列表已有标题", coverUrl: "https://images.example.test/card.jpg", releaseDate: "2026-11-10" }) {
    vi.stubGlobal("$", jquery);
    const detail = vi.fn();
    const service = new Fc2WorkspaceService({ runtimeServices: {
        movie: { detail, sourceUrls: () => [] }, scope: async () => ({ disposed: false }), logger: { error: vi.fn() },
    } });
    vi.spyOn(service, "getDetailStateController").mockReturnValue({ bind() {} });
    for (const method of ["loadNativeDetail", "loadFc2Screenshot", "mountFc2OtherSites", "bindFc2FeatureLifecycle"]) {
        vi.spyOn(service, method).mockImplementation(() => {});
    }
    const host = jquery("<main></main>").appendTo(document.body);
    const context = service.mountFc2Detail(host, { movieId: "movie-1", carNum: "FC2-123", url: "https://javdb.com/v/movie-1", source: "fc2", mode: "dialog", initialMovie });
    contexts.push(context);
    return { service, context, detail, summary: host.find('[data-jhs-role="summary-content"]'), preview: host.find('[data-jhs-role="main-preview"]') };
}

it.each(["AUTH_REQUIRED", "NETWORK_ERROR"])("keeps card metadata while loading and after %s", async code => {
    const { service, context, detail, summary, preview } = fixture();
    let reject;
    detail.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
    const request = service.fetchAndRenderNativeDetail(context);
    await vi.waitFor(() => expect(detail).toHaveBeenCalledOnce());
    expect(summary.text()).toContain("列表已有标题");
    expect(summary.text()).toContain("2026-11-10");
    expect(preview.find("img").attr("src")).toBe("https://images.example.test/card.jpg");
    expect(summary.text()).toContain("加载中");
    reject(Object.assign(new Error("fixture failure"), { code }));
    await request;
    expect(summary.text()).toContain("列表已有标题");
    expect(preview.find("img").attr("src")).toBe("https://images.example.test/card.jpg");
    expect(summary.find("button").text()).toBe(code === "AUTH_REQUIRED" ? "登录 JavDB" : "重试");
});

it("updates successful detail and keeps it through a later failed retry", async () => {
    const { service, context, detail, summary, preview } = fixture();
    detail.mockResolvedValueOnce({ title: "接口补全标题", imageUrls: ["https://images.example.test/scene.jpg"] });
    await service.fetchAndRenderNativeDetail(context);
    expect(summary.text()).toContain("接口补全标题");
    expect(summary.text()).toContain("2026-11-10");
    expect(preview.find("img").attr("src")).toBe("https://images.example.test/card.jpg");
    expect(context.root.find('[data-jhs-role="gallery-grid"] img')).toHaveLength(1);
    expect(summary.find('[data-jhs-role="detail-status"]')).toHaveLength(0);
    detail.mockRejectedValueOnce(new Error("temporary network error"));
    await service.fetchAndRenderNativeDetail(context);
    expect(summary.text()).toContain("接口补全标题");
    expect(preview.find("img").attr("src")).toBe("https://images.example.test/card.jpg");
    expect(context.root.find('[data-jhs-role="gallery-grid"] img')).toHaveLength(1);
    detail.mockResolvedValueOnce({ title: "完整标题", coverUrl: "https://images.example.test/detail.jpg", releaseDate: "2026-11-11", imageUrls: [] });
    summary.find("button").trigger("click");
    await vi.waitFor(() => expect(summary.text()).toContain("完整标题"));
    expect(preview.find("img").attr("src")).toBe("https://images.example.test/detail.jpg");
    expect(summary.text()).toContain("2026-11-11");
    expect(summary.find('[data-jhs-role="detail-status"]')).toHaveLength(0);
});

it("ignores detail responses after close", async () => {
    const { service, context, detail, summary } = fixture(null);
    let resolve;
    detail.mockImplementation(() => new Promise(done => { resolve = done; }));
    const request = service.fetchAndRenderNativeDetail(context);
    await vi.waitFor(() => expect(detail).toHaveBeenCalledOnce());
    context.destroy();
    resolve({ title: "迟到标题" });
    await request;
    expect(summary.text()).not.toContain("迟到标题");
});

it("carries safe card metadata into the owned-page URL and renders titles as text", () => {
    const title = '<img src=x onerror="alert(1)">';
    const { service, summary } = fixture({ title, coverUrl: "javascript:alert(1)" });
    expect(summary.find(".current-title").text()).toBe(title);
    expect(summary.find("img")).toHaveLength(0);
    const url = new URL(service.createFc2PageUrl("movie-1", "FC2-123", "https://javdb.com/v/movie-1", { source: "fc2", initialMovie: { title, coverUrl: "https://images.example.test/card.jpg", releaseDate: "2026-11-10" } }));
    expect(url.searchParams.get("title")).toBe(title);
    expect(url.searchParams.get("coverUrl")).toBe("https://images.example.test/card.jpg");
    expect(url.searchParams.get("releaseDate")).toBe("2026-11-10");
    const unsafe = new URL(service.createFc2PageUrl("movie-1", "FC2-123", "/v/movie-1", { initialMovie: { coverUrl: "javascript:alert(1)" } }));
    expect(unsafe.searchParams.has("coverUrl")).toBe(false);
});

it("shows the login action without existing card metadata", async () => {
    const { service, context, detail, summary, preview } = fixture(null);
    detail.mockRejectedValueOnce(Object.assign(new Error("login required"), { code: "AUTH_REQUIRED" }));
    await service.fetchAndRenderNativeDetail(context);
    expect(summary.text()).toContain("影片信息需要登录");
    expect(summary.find("button").text()).toBe("登录 JavDB");
    expect(preview.find("img")).toHaveLength(0);
});
