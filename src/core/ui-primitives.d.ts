import type { LifecycleScope } from "./lifecycle-scope.js";

export function buildUiPrimitivesCss(): string;
export function renderStateView(container: any, options?: {
    type?: string;
    title?: string;
    description?: string;
    actionLabel?: string;
    onAction?: (() => unknown) | null;
}): any;
export function initializeUiAccessibility(lifecycleScope: LifecycleScope): void;

export class JhsSelect {
    [key: string]: any;
    constructor(element: Element | any, options?: Record<string, unknown>);
    static enhance(root?: ParentNode | Element | string): JhsSelect[];
    static setValue(select: HTMLSelectElement | Element | string | any, value: unknown, emit?: boolean): void;
    static setVisible(select: HTMLSelectElement | Element | string | any, visible: boolean): void;
    destroy(): void;
}
