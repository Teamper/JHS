import type { StateFlags } from "./state-model.js";

export class StateService {
    [key: string]: any;
    constructor(storage: Record<string, any>, eventBus: Record<string, any>);
    toggle(carNum: string, flag: keyof StateFlags, activity?: Record<string, unknown>): Promise<unknown>;
    recoverPendingTransaction(): Promise<unknown>;
}

export function attachStateServiceCompatibility(stateService: StateService, storageManager: Record<string, any>): void;
