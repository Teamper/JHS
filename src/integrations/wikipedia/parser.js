// @ts-check

import { collectActressLookupNames, isJapaneseWikipediaArticle, normalizeActressLookupName, parseCupLetter } from "../../core/actress-measurements.js";

/** @param {string} value */
function compact(value) { return value.replace(/\s+/g, " ").trim(); }

/** @param {Element | null | undefined} element @param {boolean} [splitAliasLines] */
function readVisibleText(element, splitAliasLines = false) {
    if (!element) return "";
    const clone = /** @type {Element} */ (element.cloneNode(true));
    for (const node of clone.querySelectorAll("style, script, sup.reference, table, [style]")) {
        if (node.tagName === "TABLE") {
            const nestedRows = [...node.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tr")];
            const isImperial = Boolean(node.querySelector(":scope > caption")?.textContent?.includes("英米単位系"))
                || nestedRows.some((row) => {
                    const ths = row.querySelectorAll(":scope > th");
                    const tds = row.querySelectorAll(":scope > td");
                    return tds.length === 0 && ths.length === 1 && (ths[0].textContent ?? "").includes("英米単位系");
                });
            if (isImperial) node.remove();
            continue;
        }
        if (node.matches("style, script, sup.reference") || /display\s*:\s*none/i.test(node.getAttribute("style") || "")) {
            node.remove();
        }
    }
    if (splitAliasLines) {
        for (const br of clone.querySelectorAll("br")) br.replaceWith(",");
        for (const item of clone.querySelectorAll("li")) item.after(",");
    }
    return compact((clone.textContent ?? "").replace(/\[\s*(?:\d+|注\s*\d+)\s*\]/gu, " "));
}

/** @param {string} birthdayText @param {Date} [now] */
function computeAgeFromBirthday(birthdayText, now = new Date()) {
    const match = birthdayText.match(/(\d{4})\s*[年\-/.]\s*(\d{1,2})\s*[月\-/.]\s*(\d{1,2})\s*日?/u);
    if (!match) return null;
    const year = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const day = Number.parseInt(match[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    let years = now.getFullYear() - year;
    const currentMonth = now.getMonth() + 1;
    if (currentMonth < month || (currentMonth === month && now.getDate() < day)) {
        years -= 1;
    }
    return years >= 15 && years <= 99 ? years : null;
}

/** @param {URL} url */
function readTopic(url) {
    if (!isJapaneseWikipediaArticle(url)) return "";
    try {
        const topic = decodeURIComponent(url.pathname.slice(6)).normalize("NFKC");
        return /[:/]/u.test(topic) ? "" : topic;
    } catch {
        return "";
    }
}

const ACTRESS_SUFFIX = /[ _]*\(AV女優\)$/u;
const ALIAS_LABEL = /^(?:[別别]名(?:[義义])?|[芸藝艺]名)$/u;

/** Fold documented variants for identity comparison within Japanese Wikipedia. @param {string} name */
function normalizeIdentityName(name) {
    return normalizeActressLookupName(name)
        .replace(/[A-Z]/g, letter => letter.toLowerCase())
        .replace(/櫻/gu, "桜")
        .replace(/[澤泽]/gu, "沢")
        .replace(/[亞亚]/gu, "亜");
}

/** @param {Document} doc @param {URL} parsedBase @param {string} queriedName @returns {string[]} */
function extractDisambigUrls(doc, parsedBase, queriedName) {
    if (!queriedName || !isJapaneseWikipediaArticle(parsedBase)) return [];
    const contentRoot = doc.querySelector("#mw-content-text .mw-parser-output, #mw-content-text, #bodyContent, main") || doc.body;
    if (!contentRoot) return [];
    /** @type {string[]} */
    const exactMatches = [];
    const seen = new Set([parsedBase.href]);
    for (const anchor of contentRoot.querySelectorAll("a[href]")) {
        if (anchor.closest(".navbox, .vertical-navbox, .reflist, .references, .catlinks")) continue;
        const rawHref = anchor.getAttribute("href");
        if (!rawHref || rawHref.startsWith("#")) continue;
        /** @type {URL} */
        let candidate;
        try {
            candidate = new URL(rawHref, parsedBase);
        } catch {
            continue;
        }
        candidate.hash = "";
        const topic = readTopic(candidate);
        if (!ACTRESS_SUFFIX.test(topic) || normalizeIdentityName(topic.replace(ACTRESS_SUFFIX, "")) !== queriedName) continue;
        const href = candidate.href;
        if (seen.has(href)) continue;
        seen.add(href);
        exactMatches.push(href);
        if (exactMatches.length > 1) return [];
    }
    return exactMatches;
}

/** @param {string} html @param {string} url @param {string} [queriedName] */
export function parseWikipediaActressPage(html, url, queriedName = "") {
    if (typeof html !== "string") throw new TypeError("Wikipedia page must be HTML text");
    const parsedUrl = new URL(url);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const name = normalizeIdentityName(queriedName);
    const topic = readTopic(parsedUrl);
    if (name) {
        const actorCategory = [...doc.querySelectorAll("#mw-normal-catlinks a")].some(link =>
            /のAV女優$/u.test(compact(link.textContent ?? "").normalize("NFKC")));
        const titleMatches = normalizeIdentityName(topic.replace(ACTRESS_SUFFIX, "")) === name;
        const aliasMatches = [...doc.querySelectorAll("table.infobox tr")].some(row =>
            ALIAS_LABEL.test(readVisibleText(row.querySelector(":scope > th")))
            && collectActressLookupNames(readVisibleText(row.querySelector(":scope > td"), true)).some(alias => normalizeIdentityName(alias) === name));
        if (!topic || doc.querySelector("#disambigbox, .dmbox")
            || !(ACTRESS_SUFFIX.test(topic) || actorCategory) || !(titleMatches || aliasMatches)) {
            return Object.freeze({ info: null, disambigUrls: Object.freeze(extractDisambigUrls(doc, parsedUrl, name)) });
        }
    }
    let birthday = "";
    let age = "";
    let height = "";
    let weight = "";
    let threeSizeText = "";
    let braSize = "";
    let inlineBraCup = "";
    /** @type {number | null} */
    let inlineAge = null;
    let hasDeathRow = false;

    for (const table of doc.querySelectorAll("table")) {
        const rows = [...table.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tr")];
        const hasImperialHeader = Boolean(table.querySelector(":scope > caption")?.textContent?.includes("英米単位系"))
            || rows.some((row) => {
                const ths = row.querySelectorAll(":scope > th");
                const tds = row.querySelectorAll(":scope > td");
                return tds.length === 0 && ths.length === 1 && readVisibleText(ths[0]).includes("英米単位系");
            });
        if (hasImperialHeader) continue;
        for (const row of rows) {
            const th = row.querySelector(":scope > th");
            const td = row.querySelector(":scope > td");
            if (!th || !td) continue;
            const label = readVisibleText(th);
            if (!label) continue;
            if (/没年月日|死去|死亡日|命日/u.test(label) && readVisibleText(td)) {
                hasDeathRow = true;
                continue;
            }
            if (!birthday && (/誕生日|生年月日/u.test(label) || th.querySelector('a[title="誕生日"]'))) {
                const rawBirthday = readVisibleText(td);
                if (rawBirthday) {
                    if (/歳\s*没|享年/u.test(rawBirthday)) hasDeathRow = true;
                    const inlineMatch = !hasDeathRow ? rawBirthday.match(/[（(]\s*(?:現在\s*)?(\d{1,3})\s*[歳岁]\s*[)）]/u) : null;
                    if (inlineMatch) {
                        const candidateAge = Number.parseInt(inlineMatch[1], 10);
                        if (Number.isFinite(candidateAge) && candidateAge >= 15 && candidateAge <= 99) {
                            inlineAge = candidateAge;
                        }
                    }
                    birthday = compact(rawBirthday.replace(/[（(]\s*(?:現在\s*)?\d{1,3}\s*[歳岁]\s*(?:没)?\s*[)）]/gu, ""));
                }
                continue;
            }
            if (!age && label.includes("現年齢")) {
                const rawAge = readVisibleText(td);
                const match = rawAge.match(/(\d{1,3})/u);
                if (match) {
                    const parsedAge = Number.parseInt(match[1], 10);
                    if (Number.isFinite(parsedAge) && parsedAge >= 15 && parsedAge <= 99) {
                        age = `${parsedAge}岁`;
                    }
                }
                continue;
            }
            if (!height && (label.includes("身長") || th.querySelector('a[title="身長"]'))) {
                const rawHeight = readVisibleText(td);
                const matches = [...rawHeight.matchAll(/(\d+(?:\.\d+)?)\s*cm\b/giu)];
                const last = matches.at(-1);
                if (last) height = `${last[1]}cm`;
                continue;
            }
            if (!weight && (label.includes("体重") || th.querySelector('a[title="体重"]'))) {
                const rawWeight = readVisibleText(td);
                const parts = rawWeight.split("/").map((part) => compact(part)).filter(Boolean);
                const kgPart = [...parts].reverse().find((part) => /\d\s*kg\b/iu.test(part));
                const candidateWeight = kgPart ?? parts.at(-1) ?? "";
                if (candidateWeight && !/^(?:[―\-—]+(?:\s*kg)?|不明|非公開|非公表|未公表)$/iu.test(candidateWeight)) {
                    weight = candidateWeight.replace(/\s*kg\b/iu, " kg");
                }
                continue;
            }
            if (!threeSizeText && (label.includes("スリーサイズ") || th.querySelector('a[title="スリーサイズ"]'))) {
                const rawSizes = readVisibleText(td);
                if (rawSizes && !/^(?:[―\-—]+|不明|非公開|非公表|未公表)$/u.test(rawSizes)) {
                    if (!inlineBraCup) inlineBraCup = parseCupLetter(rawSizes) ?? "";
                    threeSizeText = compact(rawSizes.replace(/\s*cm\b/giu, ""));
                }
                continue;
            }
            if (!braSize && (/^(?:ブラサイズ|カップサイズ|カップ)$/u.test(label) || label.includes("ブラサイズ") || label.includes("カップサイズ"))) {
                const rawBra = readVisibleText(td);
                if (rawBra && !/^(?:[―\-—]+|不明|非公開|非公表|未公表)$/u.test(rawBra)) {
                    braSize = rawBra;
                }
            }
        }
    }

    if (!age && !hasDeathRow) {
        if (inlineAge !== null) age = `${inlineAge}岁`;
        else if (birthday) {
            const computed = computeAgeFromBirthday(birthday);
            if (computed !== null) age = `${computed}岁`;
        }
    }
    if (!braSize && inlineBraCup) braSize = inlineBraCup;

    const hasInfo = Boolean(birthday || age || height || weight || threeSizeText || braSize);
    const info = hasInfo
        ? Object.freeze({ birthday, age, height, weight, threeSizeText, braSize, url: parsedUrl.href })
        : null;
    const disambigUrls = info ? Object.freeze([]) : Object.freeze(extractDisambigUrls(doc, parsedUrl, name));
    return Object.freeze({ info, disambigUrls });
}

/** @param {string} html @param {string} url */
export function parseWikipediaActressInfo(html, url) {
    const { info } = parseWikipediaActressPage(html, url);
    if (!info) throw new TypeError("Wikipedia actress information is missing");
    return info;
}
