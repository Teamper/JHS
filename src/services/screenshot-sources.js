// @ts-check

/** 内置截图来源目录：唯一来源定义，ScreenshotService 与资源设置 UI 共用。 */
export const BUILT_IN_SCREENSHOT_SOURCES = Object.freeze([
    Object.freeze({ id: "javstore", name: "JavStore", domain: "javstore.net", priority: 10, enabled: true }),
    Object.freeze({ id: "projectjav", name: "ProjectJav", domain: "projectjav.com", priority: 20, enabled: false, implemented: false }),
    Object.freeze({ id: "18av", name: "18AV", domain: "18av.mm-cg.com", priority: 30, enabled: false, implemented: false }),
]);
