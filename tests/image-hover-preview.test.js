import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

class FakeClassList {
    constructor() { this.values = new Set(); }
    add(...values) { values.forEach((value) => this.values.add(value)); }
    remove(...values) { values.forEach((value) => this.values.delete(value)); }
    contains(value) { return this.values.has(value); }
}

class FakeStyle {
    setProperty(name, value) { this[name] = value; }
}

class FakeElement {
    constructor(tagName = "div") {
        this.tagName = tagName;
        this.children = [];
        this.parentNode = null;
        this.attributes = new Map();
        this.classList = new FakeClassList();
        this.style = new FakeStyle();
        this.selectors = new Set();
        this.id = "";
        this.src = "";
    }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    replaceChildren(...children) { this.children.forEach((child) => child.parentNode = null); this.children = []; children.forEach((child) => this.appendChild(child)); }
    remove() { this.parentNode && (this.parentNode.children = this.parentNode.children.filter((child) => child !== this)); this.parentNode = null; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) || null; }
    closest(selector) { return this.selectors.has(selector) ? this : this.parentNode?.closest?.(selector) || null; }
    contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
    get offsetWidth() { return Number.parseInt(this.style.width, 10) || 120; }
    get offsetHeight() { return Number.parseInt(this.style.height, 10) || 72; }
}

class FakeDocument {
    constructor(head, body) { this.head = head; this.body = body; this.listeners = new Map(); }
    createElement(tagName) { return new FakeElement(tagName); }
    getElementById(id) { return this.head.children.find((child) => child.id === id) || null; }
    addEventListener(type, listener) { const listeners = this.listeners.get(type) || new Set(); listeners.add(listener); this.listeners.set(type, listeners); }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    emit(type, target, x = 100, y = 100, relatedTarget = null) {
        const event = { type, target, clientX: x, clientY: y, relatedTarget };
        this.listeners.get(type)?.forEach((listener) => listener(event));
    }
}

function loadPreviewClass() {
    const head = new FakeElement("head"), body = new FakeElement("body"), document = new FakeDocument(head, body), images = [], frames = [];
    const createCover = (url) => { const cover = new FakeElement("img"); cover.src = url; cover.selectors.add(".cover"); body.appendChild(cover); return cover; };
    const firstCover = createCover("https://example.test/a.jpg");
    class FakeImage {
        constructor() { this.naturalWidth = 2e3; this.naturalHeight = 1200; images.push(this); }
        set src(value) { this.value = value; }
        get src() { return this.value; }
    }
    const context = { console, document, Image: FakeImage, JHS_Z_INDEX: { tooltip: 9999999999 }, utils: { isMobileMode: () => false }, setTimeout, clearTimeout };
    context.window = context;
    context.innerWidth = 800;
    context.innerHeight = 600;
    context.requestAnimationFrame = (callback) => (frames.push(callback), frames.length);
    context.cancelAnimationFrame = () => {};
    const source = readFileSync(join(process.cwd(), "src/core/logger.js"), "utf8"), start = source.indexOf("window.ImageHoverPreview = class"), end = source.indexOf("}, async function()", start);
    vm.runInContext(`${source.slice(start, end + 1)}; globalThis.TestImageHoverPreview = window.ImageHoverPreview;`, vm.createContext(context));
    const flushFrames = () => { while (frames.length) frames.shift()(); };
    return { Preview: context.TestImageHoverPreview, document, firstCover, createCover, head, images, flushFrames };
}

afterEach(() => vi.useRealTimers());

describe("ImageHoverPreview lifecycle", () => {
    it("uses one delegated listener set and supports dynamically rendered targets", () => {
        const { Preview, document, firstCover, createCover, images } = loadPreviewClass(), preview = new Preview({ selector: ".cover" });
        expect(document.listeners.get("mouseover")?.size).toBe(1);
        document.emit("mouseover", firstCover);
        expect(images).toHaveLength(1);
        const secondCover = createCover("https://example.test/b.jpg");
        document.emit("mouseover", secondCover);
        expect(images).toHaveLength(2);
        preview.bindEvents();
        expect(document.listeners.get("mouseover")?.size).toBe(1);
        preview.destroy();
        expect(document.listeners.get("mouseover")?.size).toBe(0);
    });

    it("delays hiding and cancels it on a quick re-entry", () => {
        vi.useFakeTimers();
        const { Preview, document, firstCover, images } = loadPreviewClass(), preview = new Preview({ selector: ".cover", hideDelay: 100 });
        document.emit("mouseover", firstCover), images[0].onload();
        document.emit("mouseout", firstCover);
        vi.advanceTimersByTime(99);
        expect(preview.preview.classList.contains("active")).toBe(true);
        document.emit("mouseover", firstCover);
        vi.advanceTimersByTime(1);
        expect(preview.preview.classList.contains("active")).toBe(true);
        expect(images).toHaveLength(1);
        document.emit("mouseout", firstCover), vi.advanceTimersByTime(100);
        expect(preview.preview.classList.contains("active")).toBe(false);
        preview.destroy();
    });

    it("keeps the old image until a new URL is ready and reuses cached URLs", () => {
        const { Preview, document, firstCover, createCover, images } = loadPreviewClass(), preview = new Preview({ selector: ".cover" });
        document.emit("mouseover", firstCover), images[0].onload();
        expect(preview.preview.children[0].src).toBe("https://example.test/a.jpg");
        const secondCover = createCover("https://example.test/b.jpg");
        document.emit("mouseover", secondCover);
        expect(preview.preview.children[0].src).toBe("https://example.test/a.jpg");
        images[1].onload();
        expect(preview.preview.children[0].src).toBe("https://example.test/b.jpg");
        document.emit("mouseover", firstCover);
        expect(images).toHaveLength(2);
        expect(preview.preview.children[0].src).toBe("https://example.test/a.jpg");
        preview.destroy();
    });

    it("ignores pending loads after destroy and keeps viewport placement stable", () => {
        const { Preview, document, firstCover, images, flushFrames } = loadPreviewClass(), preview = new Preview({ selector: ".cover", maxWidth: 1e3, maxHeight: 1e3 });
        document.emit("mouseover", firstCover, 790, 590);
        const pendingLoad = images[0].onload;
        images[0].onload(), flushFrames();
        expect(preview.placement).toEqual({ horizontal: "left", vertical: "top" });
        expect(Number.parseInt(preview.preview.style.width, 10)).toBeLessThanOrEqual(744);
        preview.destroy();
        expect(() => pendingLoad()).not.toThrow();
        expect(preview.preview).toBeNull();
    });

    it("skips selector matching for idle mouse movement", () => {
        const { Preview, document, firstCover } = loadPreviewClass(), preview = new Preview({ selector: ".cover" }), closest = vi.spyOn(firstCover, "closest");
        document.emit("mousemove", firstCover, 20, 20);
        expect(closest).not.toHaveBeenCalled();
        preview.destroy();
    });

    it("keeps only the most recent loaded image metadata", () => {
        const { Preview, document, firstCover, createCover, images } = loadPreviewClass(), preview = new Preview({ selector: ".cover", loadedUrlLimit: 2 }), second = createCover("https://example.test/b.jpg"), third = createCover("https://example.test/c.jpg");
        document.emit("mouseover", firstCover), images[0].onload(), document.emit("mouseover", second), images[1].onload(), document.emit("mouseover", third), images[2].onload();
        expect([ ...preview.loadedUrls.keys() ]).toEqual([ "https://example.test/b.jpg", "https://example.test/c.jpg" ]);
        preview.destroy();
    });
});
