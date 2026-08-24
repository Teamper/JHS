import { expect, it, vi } from "vitest";
import { TranslationService } from "../src/services/translation-service.js";

it("resolves the declared translation capability", async () => {
    const translate = vi.fn(async () => "译文");
    const integrations = { list: vi.fn(() => [{ id: "google-translate" }]), getAdapter: vi.fn(() => ({ translate })) };
    const service = new TranslationService(integrations);
    await expect(service.translate("原題")).resolves.toBe("译文");
    expect(translate).toHaveBeenCalledWith("原題", {});
});
