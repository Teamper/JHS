import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { build } from "esbuild";
import { prebuildStyles } from "./prebuild-styles.mjs";

const out = "dist/android/web";
await mkdir(out, { recursive: true });
const sourceInputs = new Set(["src/app/mobile/index.html", "src/app/mobile/app.css"]);
function collect(result) {
    for (const file of Object.keys(result.metafile.inputs)) if (/^(src|scripts)\//.test(file)) sourceInputs.add(file);
    return result;
}
const common = { bundle: true, minify: true, metafile: true, target: "chrome128", format: "iife", plugins: [{ name: "jhs-mobile-styles", setup(builder) {
    builder.onLoad({ filter: /src[\\/].*\.js$/ }, async ({ path }) => ({ contents: await prebuildStyles(path, await readFile(path, "utf8")), loader: "js" }));
} }] };
const vendors = collect(await build({ ...common, entryPoints: ["src/app/mobile/vendors.js"], write: false }));
const layer = (await readFile("node_modules/layui-layer/layer.js", "utf8")).replace("require('./layer.css');", "")
    .replace(/getPath: function\(\)\{[\s\S]*?\}\(\),/, 'getPath: "",');
await writeFile(out + "/vendors.js", `${vendors.outputFiles[0].text}\n(function(){const module={exports:{}};\n${layer}\nglobalThis.layer=module.exports;})();\n`);
collect(await build({ ...common, entryPoints: ["src/app/mobile/main.js"], outfile: out + "/main.js", define: { __JHS_SYNC_WORKER_SOURCE__: '""' } }));
collect(await build({ ...common, entryPoints: ["src/platform/userscript/sync-computation-worker.js"], outfile: out + "/sync-worker.js" }));
await build({ stdin: { contents: ["layui-layer/layer.css", "toastify-js/src/toastify.css", "viewerjs/dist/viewer.css", "tabulator-tables/dist/css/tabulator_semanticui.css"]
    .map(path => `@import "${path}";`).join("\n"), resolveDir: "node_modules", loader: "css" },
    bundle: true, minify: true, outfile: out + "/vendor.css", assetNames: "assets/[name]-[hash]", loader: { ".png": "file", ".gif": "file" } });
await Promise.all(["index.html", "app.css"].map(file => copyFile("src/app/mobile/" + file, out + "/" + file)));
await copyFile("node_modules/hls.js/LICENSE", out + "/hls-LICENSE.txt");
collect(await build({ entryPoints: ["scripts/build-android-web.mjs"], bundle: true, packages: "external",
    platform: "node", format: "esm", metafile: true, write: false }));
await writeFile("dist/android/web-inputs.json", JSON.stringify([...sourceInputs].sort(), null, 2) + "\n");
