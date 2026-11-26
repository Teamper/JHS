export type ExtensionTarget = "background" | "domain" | "platform" | "cancel";
export interface ExtensionRequest {
    channel: "jhs-extension-v1";
    target: ExtensionTarget;
    id: string;
    method: string;
    args: unknown[];
}
export type ExtensionResponse = { ok: true; value: unknown } | { ok: false; error: { name: string; message: string; code?: string; details?: unknown } };
export interface SettingChange { before: unknown; exists: boolean; value: unknown }
