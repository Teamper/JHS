// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
    CUP_FILTER_OPTIONS,
    cleanActressName,
    collectActressLookupNames,
    createBodyFilterMatcher,
    formatBodyMeasurements,
    hasActiveBodyFilter,
    isSameActressProfile,
    matchesBodyFilter,
    normalizeActressMatchKey,
    normalizeActressProfileData,
    normalizeBodyFilter,
    parseActressMeasurements,
    parseAgeYears,
    parseCupLetter,
    parseHeightCm,
    readCleanActorElementText,
    readStoredActressMeasurements,
    readVerifiedActressProfile,
} from "../src/core/actress-measurements.js";
import { JhsError, isAbortError, isNotFoundError, isTransientBlockError } from "../src/core/jhs-error.js";

describe("actress-measurements core primitives", () => {
    it("exports canonical cup filter options", () => {
        expect(CUP_FILTER_OPTIONS).toEqual(["A", "B", "C", "D", "E", "F", "G", "H+"]);
        expect(Object.isFrozen(CUP_FILTER_OPTIONS)).toBe(true);
    });

    it("cleans actress names and optional bracketed notes", () => {
        expect(cleanActressName("  三上悠亜 (無碼)  ")).toBe("三上悠亜");
        expect(cleanActressName("Alice(无码)（有碼）(有码)")).toBe("Alice");
        expect(cleanActressName("Alice [旧名] (無碼)")).toBe("Alice [旧名]");
        expect(cleanActressName("Alice [旧名] (無碼)", { stripBrackets: true })).toBe("Alice");
        expect(cleanActressName(null)).toBe("");
    });

    it("reads actor element text without mutating original badges and handles minimal stubs", () => {
        const container = document.createElement("h2");
        container.className = "actor-section-name";
        container.innerHTML = '三上悠亜, 鬼頭桃菜 <span class="jhs-actress-state-container"><span class="jhs-badge">已收藏</span></span><span class="jhs-badge">高分</span>';
        expect(readCleanActorElementText(container)).toBe("三上悠亜, 鬼頭桃菜");
        expect(container.querySelectorAll(".jhs-badge")).toHaveLength(2);

        expect(readCleanActorElementText({ textContent: "  Stub Actor  " })).toBe("Stub Actor");
        expect(readCleanActorElementText(null)).toBe("");
    });

    it("collects, splits, cleans, and deduplicates lookup names preserving order", () => {
        expect(collectActressLookupNames(
            "三上悠亜 (無碼), 鬼頭桃菜[1]",
            ["鬼頭桃菜", "三上悠亜 (有码)、桃乃木 [注1]", ["", null, 42]],
        )).toEqual(["三上悠亜", "鬼頭桃菜", "桃乃木"]);
    });

    it("parses height in 100..230 cm and rejects out-of-range or imperial-only text", () => {
        expect(parseHeightCm("159cm")).toBe(159);
        expect(parseHeightCm("159.5 cm[1]")).toBe(159.5);
        expect(parseHeightCm("158 cm → 161 cm")).toBe(161);
        expect(parseHeightCm(100)).toBe(100);
        expect(parseHeightCm(230)).toBe(230);
        expect(parseHeightCm("99cm")).toBeNull();
        expect(parseHeightCm("231cm")).toBeNull();
        expect(parseHeightCm("5 ft 3 in")).toBeNull();
        expect(parseHeightCm("120 lb")).toBeNull();
        expect(parseHeightCm("不明")).toBeNull();
    });

    it("parses age in 15..99 years and rejects invalid ages", () => {
        expect(parseAgeYears("33岁")).toBe(33);
        expect(parseAgeYears("33歳[2]")).toBe(33);
        expect(parseAgeYears("15")).toBe(15);
        expect(parseAgeYears(99)).toBe(99);
        expect(parseAgeYears("14歳")).toBeNull();
        expect(parseAgeYears("100歳")).toBeNull();
        expect(parseAgeYears("非公表")).toBeNull();
    });

    it("parses cup letters with footnote stripping, arrows, and placeholder exclusions", () => {
        expect(parseCupLetter("E")).toBe("E");
        expect(parseCupLetter("Fカップ[1]")).toBe("F");
        expect(parseCupLetter("C → E")).toBe("E");
        expect(parseCupLetter("C->D")).toBe("D");
        expect(parseCupLetter("C ⇒ G")).toBe("G");
        expect(parseCupLetter("D ➡ H[2]")).toBe("H");
        expect(parseCupLetter("83(E) - 59 - 88 cm")).toBe("E");
        expect(parseCupLetter("B83(E) W59 H88")).toBe("E");
        expect(parseCupLetter("B83 W59 H88")).toBeNull();
        expect(parseCupLetter("B: 88 / W: 58 / H: 85")).toBeNull();
        expect(parseCupLetter("B-88 / W-58 / H-85")).toBeNull();
        expect(parseCupLetter("B 88 / W 58 / H 85 (E)")).toBe("E");
        expect(parseCupLetter("B:83(E) / W:59 / H:88")).toBe("E");
        expect(parseCupLetter("H: 88")).toBeNull();
        expect(parseCupLetter("H-cup")).toBe("H");
        expect(parseCupLetter("83 - 59 - 88 cm")).toBeNull();
        expect(parseCupLetter("N/A")).toBeNull();
        expect(parseCupLetter("None")).toBeNull();
        expect(parseCupLetter("Unknown")).toBeNull();
        expect(parseCupLetter("不明")).toBeNull();
        expect(parseCupLetter("非公表")).toBeNull();
        expect(parseCupLetter("E → 不明")).toBeNull();
    });

    it("parses stored measurements and formats body measurement summaries", () => {
        const actress = {
            starId: "a1",
            name: "三上悠亞",
            actressProfileVerifiedUrl: "https://ja.wikipedia.org/wiki/test",
            actressProfile: {
                url: "https://ja.wikipedia.org/wiki/test",
                birthday: "1993年8月16日",
                age: "33岁",
                height: "159cm",
                weight: "48 kg",
                threeSizeText: "83 - 59 - 88",
                braSize: "E",
                matchedName: "三上悠亜",
                fetchedAt: 123456,
            },
        };
        expect(readStoredActressMeasurements({ ...actress, actressProfileVerifiedUrl: undefined })).toBeNull();
        expect(readStoredActressMeasurements(actress)).toEqual({ heightCm: 159, ageYears: 33, cup: "E" });
        expect(readStoredActressMeasurements({ starId: "a2", actressProfile: { url: "javascript:alert(1)", height: "160cm" } })).toBeNull();
        expect(parseActressMeasurements({ threeSizeText: "85(F) - 58 - 86", height: "162cm" })).toEqual({
            heightCm: 162, ageYears: null, cup: "F",
        });
        expect(formatBodyMeasurements(actress)).toBe("159cm · E杯 · 83 - 59 - 88 · 33岁");
        expect(formatBodyMeasurements({
            starId: "bad",
            actressProfile: { url: "javascript:bad", height: "160cm", braSize: "D", threeSizeText: "85 - 58 - 86" },
        })).toBe("");
        expect(formatBodyMeasurements({ starId: "empty", actressProfile: null })).toBe("");
        expect(formatBodyMeasurements({ height: "160cm", braSize: "D" })).toBe("160cm · D杯");
        expect(formatBodyMeasurements(null)).toBe("");
    });

    it("normalizes and matches body filters accurately", () => {
        expect(hasActiveBodyFilter(null)).toBe(false);
        expect(hasActiveBodyFilter({ heightMin: "", cups: [] })).toBe(false);
        expect(normalizeBodyFilter({ heightMin: "155", heightMax: 170, ageMin: "20", ageMax: "", cups: ["e", "H", "bad", "E"] })).toEqual({
            heightMin: 155,
            heightMax: 170,
            ageMin: 20,
            ageMax: null,
            cups: ["E", "H+"],
        });

        const matcher = createBodyFilterMatcher({ heightMin: 155, heightMax: 165, ageMin: 20, ageMax: 35, cups: ["E", "H+"] });
        expect(matcher({ heightCm: 159, ageYears: 33, cup: "E" })).toBe(true);
        expect(matcher({ heightCm: 160, ageYears: 25, cup: "I" })).toBe(true);
        expect(matcher({ heightCm: 154, ageYears: 25, cup: "E" })).toBe(false);
        expect(matcher({ heightCm: 160, ageYears: 36, cup: "E" })).toBe(false);
        expect(matcher({ heightCm: 160, ageYears: 25, cup: "D" })).toBe(false);
        expect(matcher(null)).toBe(false);
        expect(matchesBodyFilter(null, {})).toBe(true);
        expect(matchesBodyFilter({ heightCm: 160 }, { ageMin: 20 })).toBe(false);
        expect(matchesBodyFilter({ height: "160cm", cup: undefined }, { heightMin: 170 })).toBe(false);
        expect(matchesBodyFilter({ cup: "e" }, { cups: ["E"] })).toBe(true);
        expect(matchesBodyFilter({ cup: "e" }, { cups: ["H+"] })).toBe(false);
    });

    it("whitelists the 8 actressProfile fields, strips fetchedAt, validates http/https URL, and compares profiles", () => {
        const raw = {
            url: "https://ja.wikipedia.org/wiki/test",
            birthday: " 1993年8月16日 ",
            age: "33岁",
            height: "159cm",
            weight: "48 kg",
            threeSizeText: "83 - 59 - 88",
            braSize: "E",
            matchedName: "三上悠亜",
            fetchedAt: 999999,
            extra: "ignored",
        };
        const normalized = normalizeActressProfileData(raw);
        expect(normalized).toEqual({
            url: "https://ja.wikipedia.org/wiki/test",
            birthday: "1993年8月16日",
            age: "33岁",
            height: "159cm",
            weight: "48 kg",
            threeSizeText: "83 - 59 - 88",
            braSize: "E",
            matchedName: "三上悠亜",
        });
        expect(Object.hasOwn(normalized, "fetchedAt")).toBe(false);
        expect(normalizeActressProfileData({ url: "" })).toBeNull();
        expect(normalizeActressProfileData({ url: "javascript:alert(1)" })).toBeNull();
        expect(normalizeActressProfileData(["not-an-object"])).toBeNull();
        expect(isSameActressProfile(raw, normalized)).toBe(true);
        expect(isSameActressProfile(raw, { ...normalized, braSize: "F" })).toBe(false);
        expect(isSameActressProfile(null, { url: "bad" })).toBe(true);
        expect(isSameActressProfile(raw, null)).toBe(false);
    });

    it("classifies JhsError abort, not-found, and transient block predicates", () => {
        expect(isAbortError(new JhsError("ABORTED", "aborted"))).toBe(true);
        expect(isAbortError(new DOMException("aborted", "AbortError"))).toBe(true);
        expect(isAbortError(new Error("other"))).toBe(false);

        expect(isNotFoundError(new JhsError("NOT_FOUND", "missing"))).toBe(true);
        expect(isNotFoundError({ status: 404 })).toBe(true);
        expect(isNotFoundError({ details: { status: 404 } })).toBe(true);
        expect(isNotFoundError(new JhsError("NETWORK_ERROR", "net"))).toBe(false);

        expect(isTransientBlockError(new JhsError("RATE_LIMITED", "429"))).toBe(true);
        expect(isTransientBlockError(new JhsError("CIRCUIT_OPEN", "open"))).toBe(true);
        expect(isTransientBlockError(new JhsError("CF_BLOCKED", "cf"))).toBe(true);
        expect(isTransientBlockError(new JhsError("NOT_FOUND", "404"))).toBe(false);
    });

    it("normalizes fullwidth digits/cups and matches space/case/CJK variants for verified profiles", () => {
        expect(parseHeightCm("１５９ｃｍ")).toBe(159);
        expect(parseAgeYears("３３歳")).toBe(33);
        expect(parseCupLetter("Ｊ")).toBe("J");
        expect(parseCupLetter("Ｆカップ[1]")).toBe("F");

        expect(normalizeActressMatchKey("二階堂 夢")).toBe(normalizeActressMatchKey("二階堂夢"));
        expect(normalizeActressMatchKey("Miru")).toBe(normalizeActressMatchKey("miru"));
        expect(normalizeActressMatchKey("三上悠亞")).toBe(normalizeActressMatchKey("三上悠亜"));
        expect(normalizeActressMatchKey("蒼井空")).toBe(normalizeActressMatchKey("苍井空"));
        expect(normalizeActressMatchKey("澤田")).toBe(normalizeActressMatchKey("沢田"));

        const url = "https://ja.wikipedia.org/wiki/Sample";
        expect(readVerifiedActressProfile({
            name: "二階堂夢",
            allName: ["miru"],
            actressProfileVerifiedUrl: url,
            actressProfile: { url, height: "158cm", braSize: "Ｊ", matchedName: "二階堂 夢" },
        })).toMatchObject({ url, braSize: "Ｊ", matchedName: "二階堂 夢" });

        expect(readVerifiedActressProfile({
            name: "Actor",
            actressProfileVerifiedUrl: url,
            actressProfile: { url, height: "158cm", matchedName: "" },
        })).toBeNull();
    });
});
