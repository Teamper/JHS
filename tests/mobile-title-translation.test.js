// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { movieTitle, observeMovieTitles } from "../src/app/mobile/title-translation.js";

afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

it("translates only visible titles, keeps the original and cancels when the title leaves", async () => {
    let change;
    vi.stubGlobal("IntersectionObserver", class {
        constructor(callback) { change = callback; }
        observe() {}
        unobserve() {}
        disconnect() {}
    });
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const settings = Object.assign(new EventTarget(), { snapshot: () => ({ androidTranslateTitle: "yes" }) });
    const privacy = Object.assign(new EventTarget(), { enabled: false, masked: false });
    let finish;
    const translate = vi.fn(() => new Promise(done => { finish = done; }));
    const scope = new LifecycleScope("detail");
    const root = document.createElement("main");
    document.body.append(root);
    observeMovieTitles(root, { settings, privacy, translation: { translate } }, scope);
    const heading = movieTitle("h2", "河のそばを歩く", "JHSTEST-100");
    const offscreen = movieTitle("small", "見えないタイトル", "JHSTEST-101");
    root.append(heading, offscreen);
    await Promise.resolve();
    expect(translate).not.toHaveBeenCalled();
    change([{ target: heading, isIntersecting: true }]);
    const request = translate.mock.calls[0][1];
    expect(request).toMatchObject({ sourceLanguage: "auto", targetLanguage: "zh-CN" });
    expect(request.canDispatch()).toBe(true);
    finish("沿河走");
    await Promise.resolve();
    expect(heading.textContent).toBe("沿河走");
    root.querySelector("button").click();
    expect(heading.textContent).toBe("河のそばを歩く");
    change([{ target: offscreen, isIntersecting: true }]);
    const pending = translate.mock.calls[1][1];
    privacy.enabled = privacy.masked = true;
    privacy.dispatchEvent(new Event("privacy.changed"));
    expect(pending.scope.disposed).toBe(true);
    expect(pending.canDispatch()).toBe(false);
    offscreen.remove();
    finish("迟到结果");
    await Promise.resolve();
    expect(offscreen.textContent).toBe("見えないタイトル");
    scope.dispose();
});
