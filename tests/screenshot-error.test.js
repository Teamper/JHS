import { describe, expect, it } from "vitest";
import { screenshotErrorMessage } from "../src/ui/detail/screenshot-error.js";
describe("screenshot upstream availability", () => {
    it("labels unavailable and timeout responses without leaking upstream content", () => {
        expect(screenshotErrorMessage({ details: { status: 500 }, message: "private upstream html" })).toBe("截图来源暂不可用，请稍后重试");
        expect(screenshotErrorMessage({ code: "TIMEOUT" })).toContain("超时");
        expect(screenshotErrorMessage(new Error("private source URL"))).toBe("缩略图加载失败");
    });
});

it.each([["identity", "番号核验"], ["structure", "页面格式"]])("labels JavStore %s failures without exposing upstream messages", (reason, label) => {
    const error = { code: "INVALID_RESPONSE", source: "javstore", details: { reason }, message: "private upstream html" };
    expect(screenshotErrorMessage(error)).toContain(label);
    expect(screenshotErrorMessage(error)).not.toContain("private");
});
