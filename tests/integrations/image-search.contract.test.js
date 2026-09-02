import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createImageSearchAdapter, dataUrlToFormData, parseImgurUpload } from "../../src/integrations/image-search/manifest.js";

const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures/integrations/image-search/imgur-success.json"), "utf8"));

it("normalizes image upload and search target contracts", async () => {
    expect(parseImgurUpload(fixture)).toBe("https://i.imgur.com/example.png");
    const request = vi.fn(async () => ({ data: fixture, finalUrl: "https://api.imgur.com/3/image" }));
    const adapter = createImageSearchAdapter({ request });
    await expect(adapter.upload("data:image/png;base64,YQ==", { scope: "scope" })).resolves.toBe("https://i.imgur.com/example.png");
    expect(request.mock.calls[0][0]).toMatchObject({ providerId: "image-search", capability: "image.upload", method: "POST", responseType: "json", urlPolicy: { trustClass: "builtin-public" } });
    expect(request.mock.calls[0][0].body).toBeInstanceOf(FormData);
    expect(adapter.createTargets("https://i.imgur.com/a b.png")).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "google-lens", url: expect.stringContaining(encodeURIComponent("https://i.imgur.com/a b.png")) }),
        expect.objectContaining({ id: "yandex", iconUrl: "https://yandex.ru/favicon.ico" }),
    ]));
    expect(dataUrlToFormData("data:image/jpeg;base64,YQ==")).toBeInstanceOf(FormData);
});
