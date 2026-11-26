// @ts-check

import { C, _, l } from "../core/constants.js";

/** Toggle between vertical (cover-fit) and normal (contain) image display modes. */
/** @param {{ logImageHeightsByRow?: () => void } | null} [imageLayout] @param {unknown} [enableVerticalModel] */
export async function applyImageMode(imageLayout = null, enableVerticalModel) {
    $("#verticalImgStyle").remove();
    const vertical = enableVerticalModel === undefined ? C : enableVerticalModel;
    if (vertical === _) {
        let e = "100% 50% !important";
        window.location.pathname === "/tags/fc2" && new URLSearchParams(window.location.search).get("jhs_source") === "123av" && (e = "50% 50% !important");
        const t = `
                :is([data-jhs-primary-list], [data-jhs-native-recommendations]) .cover {
                    aspect-ratio: 3 / 4.26;
                    overflow: hidden !important;
                }

                :is([data-jhs-primary-list], [data-jhs-native-recommendations]) .cover img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover !important;
                    object-position: ${e};
                }

                .masonry .movie-box img {
                    aspect-ratio: 3 / 4.26;
                    object-fit: cover !important;
                    object-position: top right;
                }
            `;
        $("<style>").attr("id", "verticalImgStyle").text(t).appendTo("head");
    } else {
        const e = `
                :is([data-jhs-primary-list], [data-jhs-native-recommendations]) .cover {
                    min-height:auto !important;
                    padding-top: 67% !important;
                }
                :is([data-jhs-primary-list], [data-jhs-native-recommendations]) .cover img {
                    object-fit: contain !important;
                    object-position: 50% 50% !important
                }

                 .masonry .movie-box img {
                    min-height:auto !important;
                    object-fit: contain !important;
                    object-position: top;
                }
            `;
        $("<style>").attr("id", "verticalImgStyle").text(e).appendTo("head");
    }
}

/**
 * Apply all layout-affecting settings from a fresh snapshot without re-reading
 * legacy storage. Handles vertical image mode, container columns and container
 * width; used by settings.changed listeners and cross-tab/BFCache refreshes.
 *
 * @param {Record<string, unknown>} [snapshot]
 * @param {{ imageLayout?: any, busImgPlugin?: any, hostAdapter?: any, mobile?: boolean }} [options]
 */
export async function applyLayoutFromSettings(snapshot = {}, options = {}) {
    const imageLayout = options.imageLayout ?? options.busImgPlugin ?? null;
    const hostAdapter = options.hostAdapter ?? null;
    const vertical = snapshot.enableVerticalModel === undefined ? C : snapshot.enableVerticalModel;
    await applyImageMode(imageLayout, vertical);
    const mobile = options.mobile ?? false;
    const columns = mobile ? 1 : Number(snapshot.containerColumns ?? 5) || 5;
    const width = mobile ? 100 : Number(snapshot.containerWidth ?? 100) || 100;
    if (l && imageLayout?.logImageHeightsByRow) {
        await imageLayout.logImageHeightsByRow({ vertical, columns });
    }
    if (hostAdapter) {
        const listRoot = hostAdapter.locateListRoot?.();
        if (listRoot) {
            listRoot.setAttribute("data-jhs-primary-list", "true");
            listRoot.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
        }
        const detailRoot = hostAdapter.locateDetailRoot?.();
        detailRoot?.style.setProperty("--jhs-recommendation-columns", String(mobile ? 2 : columns));
        for (const boundary of hostAdapter.getDetailRecommendationBoundaries?.() ?? []) {
            boundary.root.style.setProperty("--jhs-recommendation-columns", String(mobile ? 2 : columns));
        }
        const layoutContainer = hostAdapter.getListLayoutContainer?.();
        if (layoutContainer) layoutContainer.style.minWidth = `${width}%`;
    }
}
