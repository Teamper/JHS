// @ts-check

import { GmHttp } from "./http.js";
import { StateService, attachStateServiceCompatibility } from "./state-service.js";
import { StorageManager } from "./storage.js";
import { Utils } from "./utils.js";

/**
 * Create legacy runtime objects only after Bootstrap has validated Vendor and GM dependencies.
 * @param {import("./event-bus.js").JhsEventBus} eventBus
 * @param {{runExclusive: (operation: () => any) => Promise<any>} | null} mutationCoordinator
 */
export function createLegacyRuntime(eventBus, mutationCoordinator = null) {
    const utils = globalThis.utils ?? new Utils();
    const storageManager = globalThis.storageManager ?? new StorageManager();
    storageManager.mutationCoordinator = mutationCoordinator;
    const gmHttp = new GmHttp({ utils, storageManager });
    const stateService = new StateService(storageManager, eventBus, mutationCoordinator);
    attachStateServiceCompatibility(stateService, storageManager);
    return Object.freeze({ utils, gmHttp, storageManager, stateService, mutationCoordinator });
}
