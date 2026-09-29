// @ts-check

/** Compatibility capability holder for Feature consumers that initialize before the responsive shell. */
export class ResponsiveShellBridge {
    constructor() {
        this.controller = null;
        this.magnetFilterAdapter = null;
        this.magnetHubAdapter = null;
    }

    /** @param {any} controller */
    attachController(controller) {
        if (this.controller && this.controller !== controller) throw new Error("Responsive shell controller already attached");
        this.controller = controller;
        if (this.magnetFilterAdapter) controller.attachFeatureMagnetFilterAdapter(this.magnetFilterAdapter);
        if (this.magnetHubAdapter) controller.attachFeatureMagnetHubAdapter(this.magnetHubAdapter);
    }

    /** @param {any} controller */
    detachController(controller) {
        if (this.controller !== controller) return;
        controller.detachFeatureMagnetFilterAdapter(this.magnetFilterAdapter);
        controller.detachFeatureMagnetHubAdapter(this.magnetHubAdapter);
        this.controller = null;
    }

    /** @param {any} adapter */
    attachFeatureMagnetFilterAdapter(adapter) {
        this.magnetFilterAdapter = adapter;
        this.controller?.attachFeatureMagnetFilterAdapter(adapter);
    }

    /** @param {any} adapter */
    detachFeatureMagnetFilterAdapter(adapter) {
        if (this.magnetFilterAdapter !== adapter) return;
        this.controller?.detachFeatureMagnetFilterAdapter(adapter);
        this.magnetFilterAdapter = null;
    }

    /** @param {any} adapter */
    attachFeatureMagnetHubAdapter(adapter) {
        this.magnetHubAdapter = adapter;
        this.controller?.attachFeatureMagnetHubAdapter(adapter);
    }

    /** @param {any} adapter */
    detachFeatureMagnetHubAdapter(adapter) {
        if (this.magnetHubAdapter !== adapter) return;
        this.controller?.detachFeatureMagnetHubAdapter(adapter);
        this.magnetHubAdapter = null;
    }
}
