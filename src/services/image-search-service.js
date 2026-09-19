// @ts-check

import { JhsError } from "../core/jhs-error.js";

export class ImageSearchService {
    /** @param {import("../app/integration-registry.js").IntegrationRegistry} integrations */
    constructor(integrations) { this.integrations = integrations; }

    /** @param {string} source @param {{scope?: import("../core/lifecycle-scope.js").LifecycleScope}} [options] */
    async resolve(source, options = {}) {
        const manifest = this.integrations.list("image.search-targets")[0];
        if (!manifest) throw new JhsError("UNSUPPORTED", "以图识图 Integration 不可用", { source: "ImageSearchService" });
        const adapter = this.integrations.getAdapter(manifest.id);
        let imageUrl = String(source || "");
        if (imageUrl.startsWith("data:")) imageUrl = await adapter.upload(imageUrl, options);
        else {
            let parsed;
            try { parsed = new URL(imageUrl); }
            catch (cause) { throw new JhsError("INVALID_URL", "图片 URL 无效", { source: "ImageSearchService", cause }); }
            if (!["http:", "https:"].includes(parsed.protocol)) throw new JhsError("INVALID_URL", "图片 URL 必须使用 HTTP/HTTPS", { source: "ImageSearchService" });
            imageUrl = parsed.href;
        }
        return Object.freeze({ imageUrl, targets: adapter.createTargets(imageUrl) });
    }
}
