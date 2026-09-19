import { expect, it } from "vitest";
import { dataUrlToFormData, parseImgurUpload } from "../../src/integrations/image-search/manifest.js";

it("rejects malformed image upload payloads", () => {
    expect(() => parseImgurUpload("not-json")).toThrow(/无效 JSON/);
    expect(() => parseImgurUpload({ success: true, data: {} })).toThrow(/响应无效/);
    expect(() => dataUrlToFormData("data:text/plain;base64,YQ==")).toThrow(/Base64 图片/);
});
