import { expect, it, vi } from "vitest";
import { assert115UploadTarget, list115Directory, upload115Subtitle } from "../../src/integrations/one115/file-transfers.js";

const target = "https://bucket.oss-cn-shenzhen.aliyuncs.com/";
const init = { host: target, object: "files/fixed-object", policy: "temporary-policy", accessid: "temporary-access", signature: "temporary-signature", callback: "temporary-callback" };
const file = { accountId: "1", folderId: "10", filename: "ABC-123.zh.srt", bytes: new TextEncoder().encode("fixture").buffer };

it("uses 115 initialization then the exact returned OSS target with one-use signatures", async () => {
    const request = vi.fn().mockResolvedValueOnce({ data: init }).mockResolvedValueOnce({ data: { state: true, data: { file_id: "55" } }, finalUrl: target });
    const identity = vi.fn(async () => ({ accountId: "1" })), dispatch = vi.fn();
    expect(await upload115Subtitle({ request }, identity, file, { onMutationDispatch: dispatch })).toEqual({ success: true, fileId: "55" });
    expect(identity).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][0]).toMatchObject({ method: "POST", retryCount: 0, url: "https://uplb.115.com/3.0/sampleinitupload.php" });
    expect(new URLSearchParams(request.mock.calls[0][0].body).get("target")).toBe("U_1_10");
    const upload = request.mock.calls[1][0];
    expect(upload).toMatchObject({ url: target, retryCount: 0, onDispatch: dispatch, requestOptions: { anonymous: true, redirect: "error" }, urlPolicy: { expectedUrl: target } });
    expect(upload.body.get("key")).toBe(init.object);
    expect(upload.body.get("file").name).toBe(file.filename);
});

it.each(["http://bucket.oss-cn-shenzhen.aliyuncs.com/", "https://evil.example/", "https://bucket.oss-cn-shenzhen.aliyuncs.com/path", "https://user:pass@bucket.oss-cn-shenzhen.aliyuncs.com/", "https://bucket.oss-cn-shenzhen.aliyuncs.com/?token=x", "https://aliyuncs.com/"])("rejects untrusted upload targets %s", value => expect(() => assert115UploadTarget(value)).toThrow());

it("does not send signatures to an invalid target or after an account change", async () => {
    const request = vi.fn(async () => ({ data: { ...init, host: "https://evil.example" } }));
    await expect(upload115Subtitle({ request }, async () => ({ accountId: "1" }), file)).rejects.toThrow("上传目标");
    expect(request).toHaveBeenCalledOnce();
    request.mockClear().mockResolvedValue({ data: init });
    const identity = vi.fn().mockResolvedValueOnce({ accountId: "1" }).mockResolvedValueOnce({ accountId: "2" });
    await expect(upload115Subtitle({ request }, identity, file)).rejects.toThrow("账号已切换");
    expect(request).toHaveBeenCalledOnce();
});

it("reads unfiltered directory files including subtitles, folder entries and hashes", async () => {
    const request = vi.fn(async () => ({ data: { state: true, count: 2, data: [{ n: "ABC-123.srt", fid: "55", s: 120, sha: "ABCD" }, { n: "folder", cid: "99" }] } }));
    expect(await list115Directory({ request }, "10")).toMatchObject({ hasMore: false, items: [{ fileId: "55", sha1: "abcd", isFolder: false }, { isFolder: true }] });
    expect(new URL(request.mock.calls[0][0].url).searchParams.has("type")).toBe(false);
});
