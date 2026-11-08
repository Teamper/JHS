import { describe, expect, it } from "vitest";
import { parseSubtitleAsset, subtitleFilename, SUBTITLE_MAX_BYTES } from "../src/core/subtitle-asset.js";

const srt = "1\n00:00:01,000 --> 00:00:02,000\n字幕 <i>文字</i>\n";
const utf8 = text => new TextEncoder().encode(text).buffer;

describe("raw subtitle assets", () => {
    it("retains bytes and decodes UTF-8 without interpreting dialogue markup", () => {
        const bytes = utf8(srt), asset = parseSubtitleAsset(bytes, { extension: ".SRT" });
        expect(asset).toMatchObject({ text: srt, encoding: "utf-8", size: bytes.byteLength, extension: "srt" });
        expect(asset.bytes).toEqual(bytes);
        expect(asset.bytes).not.toBe(bytes);
    });
    it.each(["utf-16le", "utf-16be"])("recognizes BOM-marked %s", encoding => {
        const text = "1\n00:00:01,000 --> 00:00:02,000\n字幕";
        const bytes = new Uint8Array((text.length + 1) * 2), view = new DataView(bytes.buffer), little = encoding === "utf-16le";
        view.setUint16(0, 0xfeff, little);
        [...text].forEach((char, index) => view.setUint16((index + 1) * 2, char.charCodeAt(0), little));
        expect(parseSubtitleAsset(bytes.buffer, { extension: "srt" })).toMatchObject({ text, encoding });
    });
    it("falls back to GB18030 and supports typed-array slices", () => {
        const prefix = new TextEncoder().encode("1\n00:00:01,000 --> 00:00:02,000\n");
        const bytes = new Uint8Array(prefix.length + 6);
        bytes.set(prefix, 2); bytes.set([0xd6, 0xd0, 0xce, 0xc4], prefix.length + 2);
        expect(parseSubtitleAsset(bytes.subarray(2), { extension: "srt" })).toMatchObject({ encoding: "gb18030", text: expect.stringContaining("中文") });
    });
    it.each([
        ["ass", "[Script Info]\n[Events]\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,字幕"],
        ["ssa", "[Events]\nDialogue: Marked=0,0:00:01.00,0:00:02.00,Default,,0,0,0,,字幕"],
        ["vtt", "WEBVTT\n\n00:01.000 --> 00:02.000\n字幕"],
    ])("accepts %s", (extension, text) => expect(parseSubtitleAsset(utf8(text), { extension }).text).toBe(text));
    it.each(["<!doctype html><html>Error</html>", "<?xml version='1.0'?><Error>denied</Error>", "<Error>denied</Error>", '{"error":"denied"}', "not a subtitle"])("rejects error bodies %s", text => {
        expect(() => parseSubtitleAsset(utf8(text), { extension: "srt" })).toThrow();
    });
    it("rejects empty, oversized, unsupported and HTML-labelled resources", () => {
        expect(() => parseSubtitleAsset(new ArrayBuffer(0), { extension: "srt" })).toThrow();
        expect(() => parseSubtitleAsset(new ArrayBuffer(SUBTITLE_MAX_BYTES + 1), { extension: "srt" })).toThrow();
        expect(() => parseSubtitleAsset(utf8(srt), { extension: "zip" })).toThrow();
        expect(() => parseSubtitleAsset(utf8(srt), { extension: "srt", headers: "Content-Type: text/html; charset=utf-8" })).toThrow();
        expect(subtitleFilename("../SSIS-001.srt", "srt")).toBe(".._SSIS-001.srt");
    });
    it("rejects HTML wrapping a timestamp even when the server labels it as plain text", () => {
        expect(() => parseSubtitleAsset(utf8(`<pre>${srt}</pre>`), { extension: "srt", headers: "Content-Type: text/plain" })).toThrow();
        expect(() => parseSubtitleAsset(utf8(`<!-- error -->\n${srt}`), { extension: "srt" })).toThrow();
    });
});
