// @ts-check
import { debounce, createTimers, sleep } from "../core/timing.js";
import { getNowStr, getHourDifference } from "../core/ui-date-time.js";
import { genericSort } from "../core/collection-sort.js";
import { isUrl, getUrlParam, setHrefParam } from "../core/url-parameters.js";
import { isMobile, waitForDom } from "../core/dom-actions.js";
import { importResource } from "../platform/browser/resource-loader.js";

/** The historical page-global utility entry points delegate to the running services.
 * @param {import("../services/dom-ui-service.js").DomUiService} ui
 * @param {import("../core/dialog-esc-controller.js").DialogEscController} esc
 * @param {(label: string, value: unknown) => Promise<boolean>} copyToClipboard
 * @param {import("../contracts/ports.js").DialogPort} dialogService
 */
export function createCompatibilityUtils(ui, esc, copyToClipboard, dialogService) {
    return {
        get layerIndexStack() { return esc.layerIndexStack; },
        dialogService, copyToClipboard, importResource, getNowStr, getHourDifference, debounce, sleep, genericSort, isMobile,
        isUrl, getUrlParam, setHrefParam, getDefaultArea: () => ["85%", "90%"],
        time: createTimers(),
        q: ui.q, openPage: ui.openPage, closePage: ui.closePage,
        getOwningLayerIndex: ui.getOwningLayerIndex, getDialogArea: ui.getDialogArea,
        getResponsiveArea: ui.getResponsiveArea, isMobileMode: ui.isMobileMode, trapFocus: ui.trapFocus,
        setupEscClose: ui.setupEscClose, releaseEscClose: ui.releaseEscClose,
        download: ui.download, formatDate: ui.formatDate, isHidden: ui.isHidden, smoothScrollToTop: ui.smoothScrollToTop,
        loopDetector: waitForDom,
        /** @param {string} html */
        htmlTo$dom: html => ui.jquery(new DOMParser().parseFromString(html, "text/html")),
    };
}
