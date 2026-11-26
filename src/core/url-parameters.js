// @ts-check

/** @param {string} input */
export function isUrl(input) {
    return URL.canParse(input);
}

/** Read the historical typed query value used by callers of window.utils. @param {string} url @param {string} key */
export function getUrlParam(url, key) {
    const query = url.split("?")[1];
    if (!query) return null;
    const value = new URLSearchParams(query).get(key) ?? "";
    if (value === "true" || value === "false") return value === "true";
    return value.trim() && !Number.isNaN(Number(value)) ? Number(value) : value;
}

/** @param {string} key @param {string} value */
export function setHrefParam(key, value) {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    window.history.pushState({}, "", url);
}
