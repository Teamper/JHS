// @ts-check
import "./vendors.js";
import { bootstrapJhs, mountBootstrapError } from "../../app/bootstrap.js";
import { ExtensionClient } from "../../platform/extension/client.js";
import { createRemoteRuntime } from "./remote-runtime.js";
import { detectSite } from "../../core/site-context.js";
import { PORT } from "../../contracts/tokens.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { getMovieStateEligibility, normalizeCarNum } from "../../core/movie-identity.js";
import { readCardNames, readListItem } from "../../core/list-item-reader.js";

/** @param {string | null | undefined} raw @param {string} base */
function resolveAssetUrl(raw, base) {
    if (!raw) return "";
    try {
        const url = new URL(raw, base);
        return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch {
        return "";
    }
}

/** @param {any} host @param {string} siteName */
function readDetailSnapshot(host, siteName) {
    const info = host.readMovieInfo();
    if (!info) return null;
    const doc = host.document ?? document;
    const coverNode = siteName === "javdb"
        ? doc.querySelector(".video-cover, .column-video-cover img")
        : doc.querySelector(".bigImage img, .screencap img");
    const coverUrl = resolveAssetUrl(coverNode?.getAttribute("src") || coverNode?.getAttribute("data-src"), doc.baseURI || location.href);
    const boundary = typeof host.getDetailResourceBoundary === "function" ? host.getDetailResourceBoundary() : null;
    /** @type {Array<{resource: string, title: string, sizeText: string, date: string, hasHdTag: boolean, hasSubtitleTag: boolean}>} */
    const magnets = [];
    if (boundary && typeof boundary.rows === "function") {
        for (const row of boundary.rows()) {
            const resource = boundary.getResource?.(row);
            if (!resource) continue;
            const titleText = boundary.getTitleTarget?.(row)?.textContent?.trim() || "";
            const rowText = row.textContent || "";
            const sizeText = row.querySelector(".meta")?.textContent?.trim()
                || row.querySelector("td:nth-child(2) a")?.textContent?.trim()
                || "";
            const date = row.querySelector(".date, .time")?.textContent?.trim()
                || row.querySelector("td:nth-child(3)")?.textContent?.trim()
                || "";
            const hasHdTag = Boolean(row.querySelector(".tag.is-info, .is-primary") || /\b(HD|1080P|4K|FHD)\b/i.test(rowText));
            const hasSubtitleTag = Boolean(boundary.hasSubtitleTag?.(row) || row.querySelector(".tag.is-warning") || /(字幕|中字|中文|CNSUB)/i.test(rowText));
            magnets.push({ resource, title: titleText || info.carNum, sizeText, date, hasHdTag, hasSubtitleTag });
        }
    }
    return {
        mode: "detail",
        carNum: info.carNum,
        title: info.title || info.names || info.name || "",
        url: location.href,
        eligible: getMovieStateEligibility(info).eligible,
        coverUrl,
        publishTime: info.publishTime || "",
        actress: info.actress || "",
        actors: info.actors || "",
        magnets: magnets.slice(0, 80),
    };
}

/** @param {any} host @param {any} jquery */
function readListSnapshot(host, jquery) {
    const doc = host.document ?? document;
    const nodes = typeof host.locateListItems === "function" ? host.locateListItems() : [];
    const items = [];
    const seen = new Set();
    for (const node of nodes.slice(0, 120)) {
        let parsed;
        try { parsed = readListItem(node, jquery); } catch { continue; }
        if (!parsed?.carNum || seen.has(parsed.carNum)) continue;
        seen.add(parsed.carNum);
        const img = node.querySelector("img");
        const coverUrl = resolveAssetUrl(img?.getAttribute("data-src") || img?.getAttribute("data-original") || img?.getAttribute("src"), doc.baseURI || location.href);
        const detailUrl = resolveAssetUrl(parsed.url, doc.baseURI || location.href);
        items.push({
            carNum: parsed.carNum,
            title: parsed.title || "",
            url: detailUrl || location.href,
            coverUrl,
            publishTime: parsed.publishTime || "",
            names: readCardNames(node),
            eligible: Boolean(parsed.stateEligibility?.eligible),
        });
    }
    return {
        mode: "list",
        title: doc.title || "",
        url: location.href,
        items,
    };
}

async function start() {
    if (detectSite(location).site === "unknown") return;
    if (document.documentElement.hasAttribute("data-jhs-runtime")) {
        mountBootstrapError(new Error("JHS 已在此页面运行，请选择启用油猴版或扩展版"));
        return;
    }
    document.documentElement.setAttribute("data-jhs-runtime", "extension");
    const client = new ExtensionClient();
    const options = await createRemoteRuntime(client);
    const context = await bootstrapJhs(options);
    if (!context) return;
    context.rootScope.listen(client, "disconnected", () => context.rootScope.dispose());
    document.documentElement.setAttribute("data-jhs-extension-ready", "true");
    /** @type {Parameters<typeof chrome.runtime.onMessage.addListener>[0]} */
    const readCurrentMovie = (message, sender, respond) => {
        if (message?.channel !== "jhs-current-movie" || sender.id !== chrome.runtime.id) return;
        const site = detectSite(location);
        if (!site.isJavDB && !site.isJavBus) { respond(null); return; }
        const host = context.container.resolveDeclared([PORT.host])[PORT.host];
        const jquery = /** @type {any} */ (globalThis).jQuery ?? /** @type {any} */ (globalThis).$;
        if (message.action === "focus-car" && message.carNum) {
            const target = normalizeCarNum(message.carNum);
            const nodes = typeof host.locateListItems === "function" ? host.locateListItems() : [];
            const match = nodes.find((/** @type {Element} */ node) => {
                try { return normalizeCarNum(readListItem(node, jquery).carNum) === target; } catch { return false; }
            });
            if (match instanceof HTMLElement) {
                match.scrollIntoView({ behavior: "smooth", block: "center" });
                match.animate?.([{ outline: "3px solid #3b6ea5" }, { outline: "3px solid transparent" }], { duration: 1400 });
            }
            respond({ ok: Boolean(match) });
            return;
        }
        const route = typeof host.detectRoute === "function" ? host.detectRoute() : "other";
        if (route === "detail") {
            respond(readDetailSnapshot(host, site.site));
            return;
        }
        if (route === "list") {
            respond(readListSnapshot(host, jquery));
            return;
        }
        const fallback = readDetailSnapshot(host, site.site);
        respond(fallback || { mode: "other", title: document.title || "", url: location.href });
    };
    chrome.runtime.onMessage.addListener(readCurrentMovie);
    context.rootScope.addCleanup(() => chrome.runtime.onMessage.removeListener(readCurrentMovie));
    await client.call("page.ready");
    const lifetime = new LifecycleScope("extension:document");
    lifetime.listen(window, "pagehide", event => { context.rootScope.dispose(); client.dispose(); if (!/** @type {PageTransitionEvent} */ (event).persisted) lifetime.dispose(); });
    lifetime.listen(window, "pageshow", event => { if (/** @type {PageTransitionEvent} */ (event).persisted) location.reload(); });
}
void start().catch(mountBootstrapError);
