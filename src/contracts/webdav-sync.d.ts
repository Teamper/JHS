import type { LifecycleScope } from "../core/lifecycle-scope.js";

export interface WebDavProfile {
    url: string;
    username: string;
    password: string;
}

export interface SyncStatus {
    profileConflict: boolean;
    retention?: { count: number; days: number };
    legacyRetention?: boolean;
    busy: boolean;
    enabled: boolean;
    paused: boolean;
    lastSuccessAt: number;
    retryAt: number;
    cleanupError: string;
    nextDueAt: number;
    pendingChanges: number;
    message: string;
    replicas: number;
}

export interface SyncRecoveryFile {
    name: string;
    schema: number;
    replicaId: string;
    seq: number;
    createdAt: string;
    hash: string;
}

export interface SyncRestoreSelection {
    data?: boolean;
    preferences?: boolean;
}

export interface SyncCheckOptions {
    scheduled?: boolean;
    /** Automatic wake may bypass deadlines, but still respects the interaction gate. */
    force?: boolean;
}

/** Feature and settings surfaces depend on this API, not storage or transport internals. */
export interface WebDavSync extends EventTarget {
    initializeStoreWithoutLock?(): Promise<void>;
    initialize(): Promise<void>;
    start(scope: LifecycleScope, document: Document, canRun?: () => boolean): void;
    getStatus(): Promise<SyncStatus>;
    check(options?: SyncCheckOptions): Promise<void>;
    retry(): Promise<void>;
    pause(paused: boolean): Promise<void>;
    schedule?(delay: number, force?: boolean, manual?: boolean): void;
    cancel(): void;
    listRecoveryFiles(scope?: LifecycleScope | null): Promise<SyncRecoveryFile[]>;
    previewRecovery(name: string, layout: boolean, scope: LifecycleScope | null, selection: SyncRestoreSelection): Promise<{ diff: Record<string, unknown>; apply: (scope: LifecycleScope) => Promise<void> }>;
    restore(name: string, layout?: boolean, scope?: LifecycleScope | null, selection?: SyncRestoreSelection): Promise<void>;
}
