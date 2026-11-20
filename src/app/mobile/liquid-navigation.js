// @ts-check
import { button, el } from "./components.js";

const svgNamespace = "http://www.w3.org/2000/svg";

/** @param {HTMLElement} nav */
function mountRefraction(nav) {
    if (!CSS.supports("backdrop-filter", "url(#navigation-refraction)")) return;
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 72;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const map = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const dx = 2 * x / (canvas.width - 1) - 1, dy = 2 * y / (canvas.height - 1) - 1;
            const radius = Math.min(1, Math.hypot(dx, dy)), rim = radius ** 4;
            const index = (y * canvas.width + x) * 4;
            map.data[index] = 128 - dx * rim * 108;
            map.data[index + 1] = 128 - dy * rim * 108;
            map.data[index + 3] = 255;
        }
    }
    ctx.putImageData(map, 0, 0);
    const svg = document.createElementNS(svgNamespace, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("navigation-optics");
    const filter = document.createElementNS(svgNamespace, "filter");
    filter.id = "navigation-refraction";
    filter.setAttribute("primitiveUnits", "objectBoundingBox");
    filter.setAttribute("color-interpolation-filters", "sRGB");
    const image = document.createElementNS(svgNamespace, "feImage");
    image.setAttribute("href", canvas.toDataURL());
    image.setAttribute("preserveAspectRatio", "none");
    image.setAttribute("result", "displacement");
    const displacement = document.createElementNS(svgNamespace, "feDisplacementMap");
    for (const [name, value] of Object.entries({ in: "SourceGraphic", in2: "displacement", scale: ".15", xChannelSelector: "R", yChannelSelector: "G" })) {
        displacement.setAttribute(name, value);
    }
    filter.append(image, displacement);
    svg.append(filter);
    nav.append(svg);
}

/** @param {HTMLElement} nav @param {Record<string,string>} labels @param {Record<string,string>} icons @param {(name:string)=>void} navigate @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope */
export function mountLiquidNavigation(nav, labels, icons, navigate, scope) {
    const names = Object.keys(labels);
    const lens = el("span", null, "navigation-lens");
    lens.setAttribute("aria-hidden", "true");
    nav.append(lens);
    mountRefraction(nav);
    const buttons = names.map(name => {
        const node = button("", () => navigate(name));
        const glyph = el("span", null, "navigation-glyph");
        const svg = document.createElementNS(svgNamespace, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        const path = document.createElementNS(svgNamespace, "path");
        path.setAttribute("d", icons[name]);
        svg.append(path);
        glyph.append(svg, el("span", labels[name]));
        node.append(glyph);
        node.dataset.tab = name;
        nav.append(node);
        return node;
    });
    let current = 0;
    let suppressClick = false;
    /** @type {{id:number, x:number, y:number, width:number, position:number, claimed:boolean} | null} */
    let drag = null;

    function paint(/** @type {number} */ position) {
        lens.style.setProperty("--lens-position", String(position));
        buttons.forEach((node, index) => {
            node.style.setProperty("--lens-engagement", String(drag ? Math.max(0, 1 - Math.abs(index - position)) : 0));
        });
    }
    const stop = () => {
        const active = drag;
        drag = null;
        nav.removeAttribute("data-pressed");
        nav.removeAttribute("data-dragging");
        paint(current);
        if (active && nav.hasPointerCapture(active.id)) nav.releasePointerCapture(active.id);
    };
    nav.addEventListener("pointerdown", event => {
        suppressClick = false;
        if (!event.isPrimary || event.button !== 0 || !buttons[current].contains(/** @type {Node} */ (event.target))) return;
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, width: buttons[current].getBoundingClientRect().width, position: current, claimed: false };
        nav.setAttribute("data-pressed", "");
        paint(current);
    });
    nav.addEventListener("pointermove", event => {
        if (!drag || drag.id !== event.pointerId) return;
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (!drag.claimed) {
            if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { stop(); return; }
            if (Math.abs(dx) < 8) return;
            drag.claimed = true;
            nav.setPointerCapture(event.pointerId);
            nav.setAttribute("data-dragging", "");
        }
        const direction = getComputedStyle(nav).direction === "rtl" ? -1 : 1;
        drag.position = Math.min(names.length - 1, Math.max(0, current + dx * direction / drag.width));
        paint(drag.position);
    });
    scope.listen(window, "pointerup", event => {
        const pointer = /** @type {PointerEvent} */ (event);
        if (!drag || drag.id !== pointer.pointerId) return;
        const { claimed, position } = drag;
        stop();
        if (claimed) {
            suppressClick = true;
            navigate(names[Math.round(position)]);
        }
    });
    nav.addEventListener("pointercancel", event => { if (drag?.id === event.pointerId) stop(); });
    nav.addEventListener("lostpointercapture", event => {
        if (event.target === nav && drag?.id === event.pointerId) stop();
    });
    scope.listen(window, "blur", stop);
    scope.listen(window, "resize", stop);
    nav.addEventListener("click", event => {
        if (!suppressClick || event.detail === 0) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressClick = false;
    }, true);
    const observer = new ResizeObserver(() => document.documentElement.style.setProperty("--navigation-height", nav.offsetHeight + "px"));
    observer.observe(nav);
    scope.ownObserver(observer);
    let viewportHeight = window.innerHeight, viewportWidth = window.innerWidth, nativeKeyboard = false;
    const updateKeyboard = () => {
        if (viewportWidth !== window.innerWidth) {
            viewportWidth = window.innerWidth;
            viewportHeight = window.innerHeight;
        }
        viewportHeight = Math.max(viewportHeight, window.innerHeight);
        const visibleHeight = Math.min(window.innerHeight, window.visualViewport?.height ?? window.innerHeight);
        const focused = document.activeElement;
        const editing = focused instanceof HTMLTextAreaElement
            || focused instanceof HTMLInputElement && ["search", "text", "password", "email", "number", "tel", "url"].includes(focused.type);
        const open = nativeKeyboard || editing && viewportHeight - visibleHeight > 110;
        if (open === nav.inert) return;
        stop();
        nav.inert = open;
        document.documentElement.toggleAttribute("data-keyboard", open);
    };
    scope.listen(window, "jhs:keyboard", event => {
        nativeKeyboard = Boolean(/** @type {CustomEvent} */ (event).detail);
        updateKeyboard();
    });
    if (window.visualViewport) scope.listen(window.visualViewport, "resize", updateKeyboard);
    scope.listen(window, "resize", updateKeyboard);
    return (/** @type {string} */ name) => {
        current = names.indexOf(name);
        stop();
        buttons.forEach((node, index) => {
            if (index === current) node.setAttribute("aria-current", "page");
            else node.removeAttribute("aria-current");
        });
    };
}
