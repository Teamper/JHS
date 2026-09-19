// @ts-check

/** @type {null | ((panel?: string) => Promise<unknown> | unknown)} */
let settingsOwner = null;

/** Register the active Settings UI owner and return its cleanup. @param {(panel?: string) => Promise<unknown> | unknown} owner */
export function registerSettingsUiOwner(owner) {
    if (typeof owner !== "function") throw new TypeError("Settings UI owner must be a function");
    if (settingsOwner && settingsOwner !== owner) throw new Error("Settings UI owner is already registered");
    settingsOwner = owner;
    return () => { if (settingsOwner === owner) settingsOwner = null; };
}

/** Open Settings through its owner without depending on a DOM trigger. @param {string} [panel] */
export function openSettingsUi(panel) {
    if (!settingsOwner) throw new Error("Settings UI owner is not ready");
    return settingsOwner(panel);
}
