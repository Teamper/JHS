// @ts-check

import { normalizeCarNum } from "../../core/constants.js";
import { DetailStateController } from "../../core/detail-state-controller.js";

/** Feature-owned state operations; the compatibility adapter supplies only page and UI capabilities. */
export class DetailStateActionsController {
    /** @param {{state: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, page: {readPageInfo: () => any, ui: any}}} options */
    constructor(options) {
        this.state = options.state;
        this.scope = options.scope;
        this.page = options.page;
        this.stateController = new DetailStateController(this.state, {
            ...this.page.ui,
            readState: (carNum) => this.state.getState(carNum),
        });
    }

    getStateRecord() {
        const info = this.page.readPageInfo();
        return { carNum: info.carNum, url: info.url, names: info.actress, publishTime: info.publishTime };
    }

    getStateBinding(root = this.page.ui.document) {
        const info = this.page.readPageInfo();
        return { root, layerIndex: null, carNum: normalizeCarNum(info.carNum), getRecord: () => this.getStateRecord(), activityType: "detail-state", selectors: {} };
    }

    /** @param {{root?: any, carNum: unknown}} options */
    bind({ root = this.page.ui.document, carNum }) {
        this.scope.assertActive();
        const binding = this.stateController.bind({ root, carNum, activityType: "detail-state", getRecord: () => this.getStateRecord() });
        const $ = this.page.ui.jquery;
        this.scope.addCleanup(() => $(root).find("#filterBtn,#favoriteBtn,#hasDownBtn,#hasWatchBtn").off(".jhsDetailState"));
        return binding;
    }

    /** @param {unknown} carNum */
    showStatus(carNum) { return this.stateController.render({ root: this.page.ui.document, carNum }); }
    /** @param {MouseEvent} event */
    favoriteOne(event) { return this.stateController.requestToggle(this.getStateBinding(), "favorite", event); }
    /** @param {MouseEvent} event */
    hasDownOne(event) { return this.stateController.requestToggle(this.getStateBinding(), "downloaded", event); }
    /** @param {MouseEvent} event */
    hasWatchOne(event) { return this.stateController.requestToggle(this.getStateBinding(), "watched", event); }
    /** @param {MouseEvent | null} event */
    filterOne(event) {
        event?.preventDefault();
        return this.stateController.requestToggle(this.getStateBinding(), "blocked", event);
    }
}
