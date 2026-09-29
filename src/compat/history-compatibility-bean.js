// @ts-check

/** Transitional API bridge; history state, UI and lifecycle are owned by Library Feature. */
export class HistoryCompatibilityBean {
    /** @param {(command: string, ...args: any[]) => Promise<any>} executeCommand */
    constructor(executeCommand) { this.executeCommand = executeCommand; this.controller = null; this.dataController = null; }
    getName() { return "HistoryPlugin"; }
    /** @param {any} controller */
    attachFeatureController(controller) { this.controller = controller; }
    /** @param {any} controller */
    detachFeatureController(controller) { if (this.controller === controller) this.controller = null; }
    /** @param {any} controller */
    attachFeatureDataController(controller) { this.dataController = controller; }
    /** @param {any} controller */
    detachFeatureDataController(controller) { if (this.dataController === controller) this.dataController = null; }
    get tableObj() { return this.controller?.tableObj ? { setData: () => this.controller.refresh() } : null; }
    get historyRepository() { return this.controller?.historyRepository ?? this.dataController?.repository ?? null; }
    get historySelectionModel() { return this.controller?.historySelectionModel ?? this.dataController?.selectionModel ?? null; }
    openHistory() { return this.controller?.openHistory() ?? this.executeCommand("library.history.open"); }
}
