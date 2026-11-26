import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = new URL("./www/", import.meta.url);
const sources = new Set([
    "apps/android/main.js",
    "packages/shared-fixtures/fixtures.js",
    "apps/android/media.js",
    "apps/android/navigation.js",
    "apps/android/store.js",
    "apps/android/node_modules/@capacitor/app/dist/esm/index.js",
    "apps/android/node_modules/@capacitor/app/dist/esm/web.js",
    "apps/android/node_modules/@capacitor/app/dist/esm/definitions.js",
    "apps/android/node_modules/@capacitor/core/dist/index.js",
    "src/app/mobile/browse-controls.js",
    "src/app/mobile/components.js",
    "src/app/mobile/liquid-navigation.js",
    "src/app/mobile/movie-poster.js",
    "src/core/lifecycle-scope.js",
]);
const bundled = await build({
    absWorkingDir: root,
    alias: { "@jhs/fixtures": "./packages/shared-fixtures/fixtures.js" },
    entryPoints: ["apps/android/main.js"],
    bundle: true,
    format: "esm",
    target: "chrome128",
    metafile: true,
    write: false,
});
const unexpected = Object.keys(bundled.metafile.inputs).filter(name => !sources.has(name));
if (unexpected.length) throw new Error(`离线预览包含未登记的依赖：${unexpected.join(", ")}`);
await mkdir(output, { recursive: true });
await Promise.all([
    copyFile(new URL("./index.html", import.meta.url), new URL("index.html", output)),
    copyFile(new URL("../../src/app/mobile/app.css", import.meta.url), new URL("app.css", output)),
    copyFile(new URL("./product.css", import.meta.url), new URL("product.css", output)),
    copyFile(new URL("../../packages/shared-fixtures/trailer.mp4", import.meta.url), new URL("trailer.mp4", output)),
    writeFile(new URL("main.js", output), bundled.outputFiles[0].contents),
]);
