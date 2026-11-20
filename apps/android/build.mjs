import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = new URL("./www/", import.meta.url);
const sources = new Set([
    "apps/android/main.js",
    "src/app/mobile/browse-controls.js",
    "src/app/mobile/components.js",
    "src/app/mobile/liquid-navigation.js",
    "src/app/mobile/movie-poster.js",
    "src/core/lifecycle-scope.js",
]);
const bundled = await build({
    absWorkingDir: root,
    entryPoints: ["apps/android/main.js"],
    bundle: true,
    format: "esm",
    target: "chrome128",
    metafile: true,
    write: false,
});
const unexpected = Object.keys(bundled.metafile.inputs).filter(name => !sources.has(name));
if (unexpected.length) throw new Error("离线预览包含未登记的依赖");
await mkdir(output, { recursive: true });
await Promise.all([
    copyFile(new URL("./index.html", import.meta.url), new URL("index.html", output)),
    copyFile(new URL("../../src/app/mobile/app.css", import.meta.url), new URL("app.css", output)),
    writeFile(new URL("main.js", output), bundled.outputFiles[0].contents),
]);
