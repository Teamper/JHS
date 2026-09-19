// @ts-check

import { GmHttp } from "./http.js";
import { StateService, attachStateServiceCompatibility } from "./state-service.js";
import { StorageManager } from "./storage.js";
import { Utils } from "./utils.js";

/**
 * Create legacy runtime objects only after Bootstrap has validated Vendor and GM dependencies.
 * @param {import("./event-bus.js").JhsEventBus} eventBus
 */
export function createLegacyRuntime(eventBus) {
    const utils = globalThis.utils ?? new Utils();
    const storageManager = globalThis.storageManager ?? new StorageManager();
    const gmHttp = new GmHttp({ utils, storageManager });
    const stateService = new StateService(storageManager, eventBus);
    attachStateServiceCompatibility(stateService, storageManager);
    return Object.freeze({ utils, gmHttp, storageManager, stateService });
}
