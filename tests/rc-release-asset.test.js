import { it, expect, vi } from "vitest";
import { uploadAndVerifyRcAsset } from "../scripts/rc-release-asset.mjs";

const bytes = Buffer.from("validated RC bytes");
const base = { release: { id: 42, draft: true }, name: "JHS-7.0.rc.user.js", bytes, token: "fixture-token" };
it("uploads and downloads draft assets by ID without using a public tag endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ id: 7 }), { status: 201 })).mockResolvedValueOnce(new Response(bytes));
    expect(await uploadAndVerifyRcAsset({ ...base, fetchImpl })).toEqual(bytes);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://uploads.github.com/repos/Teamper/JHS/releases/42/assets?name=JHS-7.0.rc.user.js");
    expect(fetchImpl.mock.calls[1][0]).toBe("https://api.github.com/repos/Teamper/JHS/releases/assets/7");
});
it("verifies existing bytes without overwriting an asset", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(bytes));
    await uploadAndVerifyRcAsset({ ...base, asset: { id: 7 }, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1].method).toBeUndefined();
});
it("rejects a different existing asset and published missing assets", async () => {
    await expect(uploadAndVerifyRcAsset({ ...base, asset: { id: 7 }, fetchImpl: vi.fn().mockResolvedValue(new Response("wrong")) })).rejects.toThrow(/differs/);
    const fetchImpl = vi.fn();
    await expect(uploadAndVerifyRcAsset({ ...base, release: { id: 42, draft: false }, fetchImpl })).rejects.toThrow(/refusing/);
    expect(fetchImpl).not.toHaveBeenCalled();
});
it("rejects HTTP upload/download failures", async () => {
    await expect(uploadAndVerifyRcAsset({ ...base, fetchImpl: vi.fn().mockResolvedValue(new Response("", { status: 403 })) })).rejects.toThrow(/upload HTTP 403/);
    await expect(uploadAndVerifyRcAsset({ ...base, asset: { id: 7 }, fetchImpl: vi.fn().mockResolvedValue(new Response("", { status: 404 })) })).rejects.toThrow(/download HTTP 404/);
});
