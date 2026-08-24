import type { StateFlags } from "./state-model.js";

export class StateService {
    [key: string]: any;
    toggle(carNum: string, flag: keyof StateFlags, activity?: Record<string, unknown>): Promise<unknown>;
    recoverPendingTransaction(): Promise<unknown>;
}

export const stateService: StateService;
