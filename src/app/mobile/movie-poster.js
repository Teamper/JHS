// @ts-check
import { button, el, image, movieTitle } from "./components.js";

/** @param {any} record @param {() => void} activate */
export function renderMoviePoster(record, activate) {
    const title = record.title || record.carNum || "查看作品";
    const card = button("", activate, "poster movie-poster catalog-item");
    card.dataset.work = record.id || record.carNum;
    const label = el("span", null, "card-label");
    const code = record.carNum || record.name || "";
    if (record.rank) label.append(el("span", String(record.rank), "catalog-rank"));
    label.append(movieTitle("small", title, record.carNum));
    if (code && code !== title) label.append(el("span", [code, record.ratingValue != null ? record.ratingValue.toFixed(2) + " 分" : ""].filter(Boolean).join(" · "), "movie-metadata"));
    const artwork = image(record.coverUrl, "cover");
    const frame = el("span", null, "artwork");
    frame.append(artwork);
    artwork.dataset.contentSensitive = "";
    label.dataset.contentSensitive = "";
    card.append(frame, label);
    if (record.highlight) label.append(el("span", "收藏演员出演", "movie-metadata"));
    return card;
}
