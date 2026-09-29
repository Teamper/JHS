// @ts-check

/** @param {string} category @param {string} id */
function createToken(category, id) {
    return Symbol.for(`jhs.${category}.${id}`);
}

export const PORT = Object.freeze({
    navigation: createToken("port", "navigation"),
    http: createToken("port", "http"),
    storage: createToken("port", "storage"),
    dialog: createToken("port", "dialog"),
    style: createToken("port", "style"),
    host: createToken("port", "host"),
    javdbHost: createToken("port", "javdb-host"),
    javbusHost: createToken("port", "javbus-host"),
});

export const SERVICE = Object.freeze({
    diagnostics: createToken("service", "diagnostics"),
    clog: createToken("service", "clog"),
    urlPolicy: createToken("service", "url-policy"),
    navigation: createToken("service", "navigation"),
    http: createToken("service", "http"),
    storage: createToken("service", "storage"),
    legacyStorage: createToken("service", "legacy-storage"),
    legacyUtils: createToken("service", "legacy-utils"),
    webdav: createToken("service", "webdav"),
    credential: createToken("service", "credential"),
    pan123Credential: createToken("service", "pan123-credential"),
    dialog: createToken("service", "dialog"),
    settings: createToken("service", "settings"),
    resourceSettings: createToken("service", "resource-settings"),
    notifications: createToken("service", "notifications"),
    clipboard: createToken("service", "clipboard"),
    movie: createToken("service", "movie"),
    actressInfo: createToken("service", "actress-info"),
    imageSearch: createToken("service", "image-search"),
    domUi: createToken("service", "dom-ui"),
    review: createToken("service", "review"),
    related: createToken("service", "related"),
    magnet: createToken("service", "magnet"),
    screenshot: createToken("service", "screenshot"),
    translation: createToken("service", "translation"),
    subtitle: createToken("service", "subtitle"),
    account: createToken("service", "account"),
    offline: createToken("service", "offline"),
    offlineSubmissionReceipts: createToken("service", "offline-submission-receipts"),
    cache: createToken("service", "cache"),
    state: createToken("service", "state"),
    titleKeywords: createToken("service", "title-keywords"),
    storageMutation: createToken("service", "storage-mutation"),
    busImageLayout: createToken("service", "bus-image-layout"),
    events: createToken("service", "events"),
    profile: createToken("service", "profile"),
    libraryStats: createToken("service", "library-stats"),
    hostListParser: createToken("service", "host-list-parser"),
});

export const REGISTRY = Object.freeze({
    command: createToken("registry", "command"),
    feature: createToken("registry", "feature"),
    provider: createToken("registry", "provider"),
    settings: createToken("registry", "settings"),
    integration: createToken("registry", "integration"),
});

export const CACHE = Object.freeze({
    externalDetail: "external-detail-v1",
});
