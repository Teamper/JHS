// @ts-check
import { JhsError } from "../../core/jhs-error.js";
import { defineIntegration } from "../../contracts/manifests.js";
import { SERVICE } from "../../contracts/tokens.js";
import { mediaApiUrl } from "../../core/media-library-model.js";

/** @param {any} item */
function validMediaItem(item) {
    if (!item || typeof item.Id !== "string" || !/^[\w-]+$/.test(item.Id)) return false;
    if (["Name", "OriginalTitle", "Path"].some(key => item[key] != null && typeof item[key] !== "string")) return false;
    if (item.ProviderIds != null && (typeof item.ProviderIds !== "object" || Array.isArray(item.ProviderIds) || Object.values(item.ProviderIds).some(value => typeof value !== "string"))) return false;
    return item.MediaSources == null || Array.isArray(item.MediaSources) && item.MediaSources.every((/** @type {any} */ source) => source && typeof source === "object" && (source.Path == null || typeof source.Path === "string"));
}

/** Emby and Jellyfin REST transport. Connection secrets never enter URLs. @param {any} http */
export function createMediaLibraryAdapter(http) {
    /** @param {any} connection @param {string} endpoint @param {Record<string, string>} query @param {any} scope */
    const get = async (connection, endpoint, query, scope) => {
        const url = mediaApiUrl(connection, endpoint);
        const parameters = connection.type === "jellyfin" ? Object.fromEntries(Object.entries(query).map(([key, value]) => [key[0].toLowerCase() + key.slice(1), value])) : query;
        url.search = new URLSearchParams(parameters).toString();
        const headers = connection.type === "emby" ? { "X-Emby-Token": connection.apiKey } : { Authorization: `MediaBrowser Token="${connection.apiKey}"` };
        const response = await http.request({
            capability: "media.read", method: "GET", url: url.href, responseType: "json", headers,
            requestOptions: { anonymous: true, fetch: true, redirect: "error" }, retryCount: 0, timeout: 15000,
            urlPolicy: { trustClass: "user-local", expectedOrigin: url.origin, expectedUrl: url.href },
        }, scope);
        return response.data;
    };
    return Object.freeze({
        contracts: ["MediaLibrary"],
        /** @param {any} connection @param {{scope?: any}} [options] */
        async serverInfo(connection, options = {}) {
            const info = await get(connection, "System/Info/Public", {}, options.scope);
            if (!info || typeof info.Id !== "string" || !/^[\w-]+$/.test(info.Id)) throw new JhsError("INVALID_RESPONSE", "媒体服务器身份响应无效", { source: "media-library", details: { stage: "identity" } });
            return { id: info.Id, name: String(info.ServerName || connection.name) };
        },
        /** @param {any} connection @param {{offset: number, scope?: any}} options */
        async readPage(connection, options) {
            const data = await get(connection, "Items", {
                Recursive: "true", IncludeItemTypes: "Movie,Video", Fields: "Path,OriginalTitle,ProviderIds,MediaSources",
                StartIndex: String(options.offset), Limit: "200", EnableTotalRecordCount: "true", SortBy: "SortName", SortOrder: "Ascending",
                ...(connection.userId ? { UserId: connection.userId } : {}),
            }, options.scope);
            if (!data || !Array.isArray(data.Items) || !Number.isSafeInteger(data.TotalRecordCount) || data.TotalRecordCount < 0 || !data.Items.every(validMediaItem)) throw new JhsError("INVALID_RESPONSE", "媒体目录响应无效", { source: "media-library", details: { stage: "catalog" } });
            if (data.Items.length === 0 && options.offset < data.TotalRecordCount) throw new JhsError("INVALID_RESPONSE", "媒体目录分页不完整", { source: "media-library", details: { stage: "catalog" } });
            return { items: data.Items, total: data.TotalRecordCount };
        },
    });
}

export default defineIntegration({
    id: "media-library", trustClass: "user-local", hosts: [], capabilities: ["media.read"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ deps) => ({ http: deps[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createMediaLibraryAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "media.read": "none" }, quality: "silver",
});
