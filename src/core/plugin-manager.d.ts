export class PluginManager {
    constructor(options?: { diagnostics?: any });
    register(pluginClass: new () => BasePlugin, runtimeServices?: Record<string, unknown>): void;
    getBean(name: string): BasePlugin | undefined;
    resolveDeclaredPlugin(name: string): BasePlugin | undefined;
    getErrorLog(): unknown[];
    clearErrorLog(): void;
    getTimings(): unknown[];
    getPluginNames(): string[];
    getStartupReport(): Record<string, number>;
    processCss(): Promise<void>;
    processPlugins(): Promise<void>;
}

export class BasePlugin {
    [key: string]: any;
    constructor(...args: any[]);
    pluginManager: PluginManager;
    declaredDependencies: Set<string>;
    runtimeServices: Readonly<Record<string, unknown>>;
    getName(): string;
    getDependency(name: string): any;
    getRuntimeService(name: string): any;
    initCss(): string | undefined | Promise<string | undefined>;
    handle(): void | Promise<void>;
    getStartupMode(): "immediate" | "idle";
    shouldSkipOnMobile(): boolean;
}
