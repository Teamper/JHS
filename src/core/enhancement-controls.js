// @ts-check
import { parseBooleanSetting } from "./feature-helpers.js";

/** Shared identity for runtime gates and the settings management view. */
export const ENHANCEMENT_FEATURES = Object.freeze({
    "subtitle-workspace": "统一字幕面板",
    "media-library": "媒体库联动入口",
    privacy: "隐私工具",
    "movie-lists": "JavDB 清单管理",
    "personal-ratings": "个人评分",
    "movie-selection": "跨页批量选择",
    "translation-tools": "手动标题翻译",
});

/** Settings and runtime share this catalog, including the upload preference owned by subtitles. */
export const ENHANCEMENT_METADATA = Object.freeze({
    "subtitle-workspace": { group: "资源与字幕", settingsEntry: "resources-panel", pages: ["list", "detail", "owned-detail"], dependencies: [] },
    "subtitle115-upload": { name: "115 字幕直传", settingKey: "enableSubtitle115Upload", group: "资源与字幕", settingsEntry: "cloud-panel", pages: ["list", "detail", "owned-detail"], dependencies: ["subtitle-workspace"] },
    "media-library": { settingKey: "enableMediaLibrary", group: "媒体与隐私", settingsEntry: "resources-panel", pages: ["list", "detail", "owned-detail"], dependencies: [] },
    privacy: { group: "媒体与隐私", settingsEntry: "appearance-panel", pages: ["list", "detail", "owned-detail"], dependencies: [] },
    "movie-lists": { group: "清单与评分", settingsEntry: "advanced-panel", pages: ["list", "detail", "owned-detail"], dependencies: [] },
    "personal-ratings": { group: "清单与评分", settingsEntry: "advanced-panel", pages: ["list", "detail", "owned-detail"], dependencies: [] },
    "movie-selection": { group: "批量操作", settingsEntry: "advanced-panel", pages: ["list"], dependencies: ["list", "list.core", "list.actions"] },
    "translation-tools": { group: "翻译", settingsEntry: "resources-panel", pages: ["list", "detail", "owned-detail"], dependencies: [] },
});

/** Preserve the previous shared translation owner only on the first upgrade. @param {Record<string, any>} draft */
export function initializeEnhancementControls(draft) {
    let previous;
    try { previous = typeof draft.disabledPlugins === "string" ? JSON.parse(draft.disabledPlugins) : draft.disabledPlugins; } catch {}
    if (Array.isArray(previous) && previous.includes("media-library")) {
        draft.enableMediaLibrary = false;
        draft.disabledPlugins = JSON.stringify(previous.filter(id => id !== "media-library"));
    }
    if (draft.independentControlsInitialized) return;
    draft.independentControlsInitialized = true;
    if (Object.hasOwn(draft, "enhancementsEnabled")) return;
    let disabled;
    try { disabled = typeof draft.disabledPlugins === "string" ? JSON.parse(draft.disabledPlugins) : draft.disabledPlugins; } catch { return; }
    if (Array.isArray(disabled) && disabled.some(id => ["TranslatePlugin", "external-bridge.translation", "translation"].includes(id))) {
        draft.disabledPlugins = JSON.stringify([...new Set([...disabled, "translation-tools"])]);
    }
}

/** @param {any} settings */
export function subtitleUploadEnabled(settings) {
    return parseBooleanSetting(settings?.enableSubtitle115Upload, true);
}
