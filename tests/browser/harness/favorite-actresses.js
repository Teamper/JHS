import { fulfillHostFixtures, injectUserscriptRuntime } from "./runtime.js";

export async function openFavoriteActressDetail(context, page, theme) {
  await fulfillHostFixtures(context);
  await page.goto("https://javdb.com/v/test-id");
  await injectUserscriptRuntime(page, {
    hostStyles: true,
    disabledPlugins: ["FoldCategoryPlugin"],
    settingOverrides: { themeMode: theme, enableFavoriteActresses: "yes", highlightedTagNumber: 2, highlightedTagColor: "#ce2222", enableLoadReview: "no" },
    beforeUserscriptInjection: (hostPage) => hostPage.evaluate(async () => {
      const forage = window.localforage.createInstance({ driver: window.localforage.INDEXEDDB, name: "JAV-JHS", version: 1, storeName: "appData" });
      await forage.setItem("data_version", 3);
      const cast = document.createElement("div");
      cast.id = "favorite-cast";
      cast.className = "panel-block";
      // Fixed local fixture; no external content is interpolated.
      cast.innerHTML = '<strong>演员:</strong> <span class="value"><a id="saved-actor" class="actor-female" title="原提示" href="/actors/saved">收藏演员</a> <a id="unsaved-actor" class="actor-female" href="/actors/other">其他演员</a> <a id="male-actor" class="actor-male" href="/actors/saved">男性演员</a> <a id="unknown-actor" href="/actors/saved">未知角色</a> <a id="legacy-actor" href="/actors/legacy">旧结构演员</a><i class="female"></i></span>';
      const surface = document.createElement("style");
      surface.textContent = "#favorite-cast{background:var(--jhs-surface);color:var(--jhs-text)}#favorite-cast strong{color:inherit}#favorite-cast a{color:var(--jhs-accent)}";
      document.head.append(surface);
      await forage.setItem("favorite_actresses", [{ starId: "saved", name: "收藏演员", allName: ["收藏演员"] }, { starId: "legacy", name: "旧结构演员", allName: ["旧结构演员"] }]);
      document.querySelector(".column-video-info").append(cast);
    }),
  });
  await page.waitForFunction(() => window.__jhsBrowserDiagnostics.bootstrapPhases["first-ready"]);
}
