// @ts-check

export const PRIVACY_KIND_ATTRIBUTE = "data-jhs-privacy-kind";
export const PRIVACY_DOCUMENT_TITLE_ATTRIBUTE = "data-jhs-privacy-original-document-title";

/** Site-specific native selectors remain owned by host adapters. */
/** @param {Element} element */
export function explicitPrivacyKind(element) {
    const kind = element.getAttribute(PRIVACY_KIND_ATTRIBUTE);
    return kind === "actor" ? "actors" : kind;
}
const OWN_SELECTORS = Object.freeze({
    title: '.jhs-fc2-title,.jhs-fc2-original-title,.current-title,.new-video-title,.movie-title,.translated-title,.tabulator-cell[tabulator-field="title"],.jhs-history-details dd,.magnet-title > a,.magnet-name .name,a[href^="magnet:"],.jhs-record-card > strong:first-child,.jhs-media-details a,.jhs-115-match-filename',
    code: '[data-jhs-library-code],.jhs-fc2-meta,.tabulator-cell[tabulator-field="carNum"],.nv-card__title,.jhs-fc2-magnet-name > a,.jhs-magnet-result__title,.layui-layer-title,.jhs-subtitles__row,.jhs-115-rename-preview__text,.jhs-record-card > p,.jhs-media-details > div',
    actors: '.jhs-fc2-actors,.tabulator-cell[tabulator-field="names"],.actress-name,.actress-card-name,.actress-card-allname,.nv-card__actress,.actress-card-header,.jhs-history-details dt + dd,.jhs-stats__label,.tabulator-cell[tabulator-field="name"],.jhs-source-health-item__name,.jhs-rebind-candidate__name,.jhs-rebind-candidate__meta',
    images: '.jhs-owned-detail img,.jhs-detail-workspace img,.jhs-fc2-gallery img,.jhs-fc2-preview img,.jhs-screenshot-panel img,.screen-container img,.image-hover-preview img,.jhs-image-viewer img,.viewer-container img,#actress-card-container img,.new-video-card img,.nv-card img,.layui-layer-content img',
    video: "video,canvas",
});

/** Native selectors are supplied by the active host adapter. @param {Record<string, string>} native @returns {Record<string, string>} */
export function privacySelectors(native) {
    return Object.fromEntries(Object.entries(OWN_SELECTORS).map(([kind, selector]) => [kind, [native[kind], selector, `[${PRIVACY_KIND_ATTRIBUTE}="${kind}"]`, kind === "actors" && `[${PRIVACY_KIND_ATTRIBUTE}="actor"]`].filter(Boolean).join(",")]));
}
