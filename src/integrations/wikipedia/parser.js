// @ts-check

/** @param {string} value */
function compact(value) { return value.replace(/\s+/g, " ").trim(); }

/** @param {string} html @param {string} url */
export function parseWikipediaActressInfo(html, url) {
    const document = new DOMParser().parseFromString(html, "text/html");
    const birthday = compact(document.querySelector('a[title="誕生日"]')?.closest("tr")?.querySelector("td")?.textContent ?? "");
    const ageCell = [...document.querySelectorAll("th")].find((item) => item.textContent?.includes("現年齢"))?.parentElement?.querySelector("td");
    const heightCell = document.querySelector('a[title="身長"]')?.closest("tr")?.querySelector("td");
    const weightCell = document.querySelector('a[title="体重"]')?.closest("tr")?.querySelector("td");
    const sizesCell = document.querySelector('a[title="スリーサイズ"]')?.closest("tr")?.querySelector("td");
    const braCell = [...document.querySelectorAll("th")].find((item) => item.textContent?.includes("ブラサイズ"))?.nextElementSibling;
    if (!birthday && !heightCell && !sizesCell) throw new TypeError("Wikipedia actress information is missing");
    const age = Number.parseInt(compact(ageCell?.textContent ?? ""), 10);
    const height = compact(heightCell?.textContent ?? "").split(" ")[0];
    const weightParts = compact(weightCell?.textContent ?? "").split("/");
    const weight = compact(weightParts.at(-1) ?? "").replace(/^―\s*kg$/, "");
    return Object.freeze({
        birthday,
        age: Number.isFinite(age) ? `${age}岁` : "",
        height: height && !height.endsWith("cm") ? `${height}cm` : height,
        weight,
        threeSizeText: compact(sizesCell?.textContent ?? "").replace("cm", "").trim(),
        braSize: compact(braCell?.textContent ?? ""),
        url: new URL(url).href,
    });
}
