// @ts-check

/** @param {string[]} keywords @param {string} title @param {string} carNum */
export function findMatchedTitleKeyword(keywords, title, carNum) {
    return keywords.find(keyword => title.includes(keyword) || carNum.startsWith(keyword)) ?? null;
}
