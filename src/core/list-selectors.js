// @ts-check

/** Return the compatibility selector set used when no HostAdapter is available. */
/** @param {string} site */
export function getDefaultListSelectors(site) {
    return site === "javbus"
        ? Object.freeze({ boxSelector: ".masonry", itemSelector: ".masonry .item", coverImgSelector: ".masonry .movie-box .photo-frame img", requestDomItemSelector: "#waterfall .item", nextPageSelector: "#next" })
        : Object.freeze({ boxSelector: ".movie-list", itemSelector: ".movie-list .item", coverImgSelector: ".cover img", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" });
}
