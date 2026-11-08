import { expect, it } from "vitest";
import { createMediaLibraryAdapter } from "../../src/integrations/media-library/manifest.js";

const connection = { type: "jellyfin", address: "https://server.example/", apiKey: "fixture" };
it.each([null, "<html>Error</html>", { Items: [], TotalRecordCount: -1 }, { Items: [], TotalRecordCount: 1 }, { Items: [{ Name: "ABC-123" }], TotalRecordCount: 1 }, { Items: [{ Id: "../secret?key=value" }], TotalRecordCount: 1 }])("rejects malformed, error or incomplete directory responses", async data => {
    const adapter = createMediaLibraryAdapter({ request: async () => ({ data }) });
    await expect(adapter.readPage(connection, { offset: 0 })).rejects.toThrow();
});
it.each([null, { ServerName: "test" }, { Id: "bad/id" }])("requires a stable server identifier", async data => {
    const adapter = createMediaLibraryAdapter({ request: async () => ({ data }) });
    await expect(adapter.serverInfo(connection)).rejects.toThrow();
});
it.each([{ Name: {} }, { Path: [] }, { ProviderIds: [] }, { ProviderIds: { Imdb: 123 } }, { MediaSources: {} }, { MediaSources: [{ Path: {} }] }])("rejects malformed identity metadata instead of treating it as an absent movie", async fields => {
    const adapter = createMediaLibraryAdapter({ request: async () => ({ data: { Items: [{ Id: "a", ...fields }], TotalRecordCount: 1 } }) });
    await expect(adapter.readPage(connection, { offset: 0 })).rejects.toThrow();
});
