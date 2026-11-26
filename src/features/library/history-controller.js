// @ts-check

import { HistoryRepository } from "./history-repository.js";
import { HistorySelectionModel } from "./history-selection-model.js";

/** Feature-owned history data and selection state shared with the legacy UI adapter. */
export class HistoryController {
    /** @param {{state: import("../../core/state-service.js").StateService}} dependencies */
    constructor(dependencies) {
        this.repository = new HistoryRepository(dependencies);
        this.selectionModel = new HistorySelectionModel();
    }

    dispose() { this.selectionModel.clear(); }
}
