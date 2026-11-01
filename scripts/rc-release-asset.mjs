/** Address drafts by release/asset ID: the public tag endpoint does not expose drafts. */
export async function uploadAndVerifyRcAsset({ release, asset, name, bytes, token, fetchImpl = fetch }) {
    const authorization = { Authorization: `Bearer ${token}` };
    if (!asset) {
        if (!release.draft) throw new Error("Published RC has missing assets; refusing to mutate it");
        const response = await fetchImpl(`https://uploads.github.com/repos/Teamper/JHS/releases/${release.id}/assets?name=${encodeURIComponent(name)}`, {
            method: "POST", headers: { ...authorization, "Content-Type": "application/octet-stream", Accept: "application/vnd.github+json" }, body: bytes, signal: AbortSignal.timeout(120000),
        });
        if (!response.ok) throw new Error(`RC upload HTTP ${response.status}: ${name}`);
        asset = await response.json();
    }
    if (!Number.isSafeInteger(asset.id)) throw new Error("Invalid RC asset ID");
    const response = await fetchImpl(`https://api.github.com/repos/Teamper/JHS/releases/assets/${asset.id}`, {
        headers: { ...authorization, Accept: "application/octet-stream" }, signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`RC download HTTP ${response.status}: ${name}`);
    const downloaded = Buffer.from(await response.arrayBuffer());
    if (!downloaded.equals(bytes)) throw new Error(`Existing RC asset differs: ${name}`);
    return downloaded;
}
