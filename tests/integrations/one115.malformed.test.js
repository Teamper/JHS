import { expect, it, vi } from "vitest";
import { createOne115Adapter, normalize115SearchResults } from "../../src/integrations/one115/manifest.js";

it("rejects malformed 115 search responses", () => {
    expect(() => normalize115SearchResults({ state: true })).toThrow(/搜索响应无效/);
});

it("normalizes duplicate and login-required offline responses", async () => {
    for (const [message, code] of [["该任务已存在", "TASK_EXISTS"], ["请先登录", "AUTH_REQUIRED"]]) {
        const request = vi.fn()
            .mockResolvedValueOnce({ data: { sign: "s", time: "t", uid: 1 } })
            .mockResolvedValueOnce({ data: { state: false, error_msg: message } });
        await expect(createOne115Adapter({ request }).submit("magnet:?xt=urn:btih:abc")).rejects.toMatchObject({ code });
    }
});
