import { button, el } from "../../src/app/mobile/components.js";
import { artwork } from "./fixtures.js";

export function previewImage(work, kind = "cover", index = 0) {
    if (kind === "cover" && !work.cover) return el("span", "暂无封面", "missing-art");
    const node = el("img");
    node.alt = "";
    node.src = artwork(work, kind, index);
    return node;
}

function fullscreen(root, label) {
    const dialog = el("dialog", null, "full-media");
    const close = button("关闭", () => dialog.close());
    const header = el("header");
    const heading = el("h2", label);
    header.append(heading, close);
    dialog.setAttribute("aria-label", label);
    dialog.append(header);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    root.append(dialog);
    return { dialog, heading };
}

function play(root) {
    const { dialog } = fullscreen(root, "预告");
    const video = el("video");
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.src = "trailer.mp4";
    const status = el("p");
    status.setAttribute("role", "status");
    video.addEventListener("error", () => { status.textContent = "预告无法播放，请关闭后重试。"; });
    dialog.addEventListener("close", () => video.pause(), { once: true });
    dialog.append(video, status);
    dialog.showModal();
}

function gallery(root, work, pictures, first) {
    const { dialog, heading } = fullscreen(root, "作品画面");
    const viewport = el("div", null, "image-viewport");
    const controls = el("div", null, "image-tools");
    let index = first, zoom = 1, image, gesture;
    const previous = button("上一张", () => show(index - 1));
    const next = button("下一张", () => show(index + 1));
    const smaller = button("缩小", () => resize(zoom / 1.4));
    const larger = button("放大", () => resize(zoom * 1.4));
    const counter = el("p");
    counter.setAttribute("aria-live", "polite");
    controls.append(previous, smaller, larger, next);
    dialog.append(viewport, counter, controls);

    function resize(value, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2) {
        const width = image.offsetWidth || viewport.clientWidth;
        const left = (viewport.scrollLeft + x - Math.max(0, (viewport.clientWidth - width) / 2)) / width;
        const top = (viewport.scrollTop + y) / width;
        zoom = Math.min(4, Math.max(1, value));
        image.style.width = `${Number(image.dataset.width) * zoom}%`;
        viewport.scrollLeft = left * image.offsetWidth - x;
        viewport.scrollTop = top * image.offsetWidth - y;
        smaller.disabled = zoom <= 1;
        larger.disabled = zoom >= 4;
    }

    function show(position) {
        if (position < 0 || position >= pictures.length) return;
        index = position;
        const picture = pictures[index];
        image = previewImage(work, picture.kind, picture.index);
        image.alt = picture.label;
        image.dataset.width = picture.kind === "contact" ? 100 : 100 * Math.min(1,
            viewport.clientHeight * 800 / (490 * viewport.clientWidth));
        viewport.replaceChildren(image);
        resize(1);
        viewport.scrollTo(0, 0);
        previous.disabled = index === 0;
        next.disabled = index === pictures.length - 1;
        counter.textContent = `${picture.label} · ${index + 1}/${pictures.length}`;
        heading.textContent = work.carNum;
    }

    const distance = touches => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    viewport.addEventListener("touchstart", event => {
        const touch = event.touches[0];
        if (event.touches.length === 2) {
            gesture = { pinch: distance(event.touches), zoom };
            return;
        }
        if (event.touches.length === 1) gesture = {
            x: touch.clientX, y: touch.clientY, left: viewport.scrollLeft <= 1,
            right: viewport.scrollLeft >= viewport.scrollWidth - viewport.clientWidth - 1,
        };
    }, { passive: true });
    viewport.addEventListener("touchmove", event => {
        if (!gesture) return;
        if (event.touches.length === 2 && gesture.pinch) {
            event.preventDefault();
            const [a, b] = event.touches;
            const rect = viewport.getBoundingClientRect();
            resize(gesture.zoom * distance(event.touches) / gesture.pinch,
                (a.clientX + b.clientX) / 2 - rect.left, (a.clientY + b.clientY) / 2 - rect.top);
        } else if (event.touches.length === 1 && !gesture.pinch) {
            const dx = event.touches[0].clientX - gesture.x, dy = event.touches[0].clientY - gesture.y;
            if (Math.abs(dx) > Math.abs(dy) + 12 && (dx > 0 ? gesture.left : gesture.right)) event.preventDefault();
        }
    }, { passive: false });
    viewport.addEventListener("touchend", event => {
        if (event.touches.length || !gesture) return;
        const { x, y, left, right } = gesture;
        gesture = null;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - x, dy = touch.clientY - y;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4 && (dx > 0 ? left : right)) {
            show(index + (dx > 0 ? -1 : 1));
        }
    });
    viewport.addEventListener("touchcancel", () => { gesture = null; });
    dialog.addEventListener("keydown", event => {
        if (event.key === "ArrowLeft") show(index - 1);
        if (event.key === "ArrowRight") show(index + 1);
    });
    dialog.showModal();
    show(index);
    window.addEventListener("resize", () => {
        if (zoom === 1 && image.dataset.width !== "100") show(index);
    }, { signal: (() => {
        const lifecycle = new AbortController();
        dialog.addEventListener("close", () => lifecycle.abort(), { once: true });
        return lifecycle.signal;
    })() });
}

export function mediaStrip(root, work) {
    const strip = el("div", null, "media-strip");
    strip.setAttribute("aria-label", "预告和作品画面");
    const pictures = [
        ...(work.contact ? [{ kind: "contact", index: 0, label: "长图" }] : []),
        ...Array.from({ length: work.stills }, (_, index) => ({ kind: "still", index: index + 1, label: `截图 ${index + 1}` })),
    ];
    function tile(label, activate, kind, variant) {
        const action = button("", activate, "media-tile");
        action.append(previewImage(work, kind, variant), el("span", label));
        action.dataset.contentSensitive = "";
        strip.append(action);
    }
    if (work.trailer) tile("▶ 预告", () => play(root), "still", 2);
    pictures.forEach(({ kind, index, label }, position) => tile(label, () => gallery(root, work, pictures, position),
        "still", kind === "contact" ? 0 : index));
    return strip;
}
