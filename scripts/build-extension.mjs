import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { repoRoot } from "./build.mjs";
import { prebuildStyles } from "./prebuild-styles.mjs";

const output = join(repoRoot, "dist/extension/dev");
await mkdir(output, { recursive: true });
const manifest = {
    manifest_version: 3, name: "JHS Dev", version: "0.1.0", version_name: "0.1.0-dev",
    description: "JHS 跨站作品库、页面增强、后台同步与资源管理", minimum_chrome_version: "128",
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsUilEzc27W9iOWxa44isgfGCjQPsdJbZP2J/rB1fKHvEf+FCHqwsa2UOgRB410LUnqBnLh+JMrDDRW1+15IgRbzC0Qrhml6z6JbSuMjZPEXpVlcxtRhCHK5r6uC84FzXVzh2/j5NHjxJJPUHNCrQ1uUCk2GsQwvnEaKOhHT7E8nENOz1Is/oVmlkG8lbt/s83eGWz+zbmM5cVWeWVrQis3tZplQ4TX9Trkoi+P5Zh09KvnKmLU7YiDeqnenObaEF8pdfgnncbD4nFX1DGqvi34ME6WsTwRYKQDJJXCh3h94hyafHTMwUJQxVRdmIYhf821EKFcWsQdgj6FanCyYH9QIDAQAB",
    permissions: ["storage", "alarms", "offscreen", "sidePanel", "scripting", "activeTab", "declarativeNetRequestWithHostAccess", "webRequest"],
    host_permissions: [], optional_host_permissions: ["https://*/*", "http://*/*"],
    background: { service_worker: "background.js", type: "module" },
    action: { default_title: "JHS" }, side_panel: { default_path: "sidepanel.html" },
    options_ui: { page: "manager.html", open_in_tab: true },
    content_scripts: [{ matches: ["https://*.javdb.com/*", "https://*.javbus.com/*", "https://*.123pan.com/*", "https://javtrailers.com/*", "https://subtitlecat.com/*", "https://*.subtitlecat.com/*"], exclude_matches: ["https://*.javbus.com/forum/*"], js: ["vendors.js", "content.js"], css: ["vendor.css"], run_at: "document_idle", all_frames: true }],
    web_accessible_resources: [{ resources: ["sync-worker.js", "assets/*"], matches: ["https://*/*"] }],
    content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
};
const main = await readFile(join(repoRoot, "src/main.js"), "utf8");
manifest.host_permissions = [...new Set([...main.matchAll(/^\/\/ @connect\s+(\S+)/gm)].map(match => match[1]).filter(host => host !== "*").map(host => `https://*.${host}/*`))];
manifest.host_permissions.push("https://*.aliyuncs.com/*");
const common = { bundle: true, minify: true, target: "es2020", absWorkingDir: repoRoot, legalComments: "inline", logLevel: "warning", plugins: [{ name: "jhs-styles", setup(builder) {
    builder.onLoad({ filter: /src[\\/].*\.js$/ }, async args => ({ contents: await prebuildStyles(args.path, (await readFile(args.path, "utf8")).replace(/^import "\.\/vendors\.js";\r?\n/m, "")), loader: "js" }));
} }] };
const vendors = await build({ ...common, entryPoints: ["src/app/extension/vendors.js"], write: false, format: "iife" });
const layer = (await readFile(join(repoRoot, "node_modules/layui-layer/layer.js"), "utf8"))
    .replace("require('./layer.css');", "")
    .replace(/getPath: function\(\)\{[\s\S]*?\}\(\),/, 'getPath: "",');
await writeFile(join(output, "vendors.js"), `${vendors.outputFiles[0].text}\n(function(){const module={exports:{}};\n${layer}\nglobalThis.layer=module.exports;})();\n`);
for (const entry of ["background", "content", "domain", "shell"]) {
    await build({ ...common, entryPoints: [`src/app/extension/${entry}.js`], outfile: join(output, `${entry}.js`), format: entry === "background" ? "esm" : "iife", define: { __JHS_SYNC_WORKER_SOURCE__: '""' } });
}
await build({ ...common, entryPoints: ["src/platform/userscript/sync-computation-worker.js"], outfile: join(output, "sync-worker.js"), format: "iife" });
await build({ stdin: { contents: ['layui-layer/layer.css', 'toastify-js/src/toastify.css', 'viewerjs/dist/viewer.css', 'tabulator-tables/dist/css/tabulator_semanticui.css'].map(path => `@import "${path}";`).join("\n"), resolveDir: join(repoRoot, "node_modules"), loader: "css" }, bundle: true, minify: true, outfile: join(output, "vendor.css"), assetNames: "assets/[name]-[hash]", loader: { ".png": "file", ".gif": "file" } });
for (const page of ["manager", "sidepanel", "offscreen"]) {
    const ui = page === "offscreen"
        ? '<script src="vendors.js"></script><script src="domain.js"></script>'
        : page === "manager"
            ? '<div class="jhs-ext-shell"><aside class="jhs-ext-sidebar"><div class="jhs-ext-brand"><strong>JHS</strong><span class="jhs-badge jhs-badge--accent">工作台</span></div><nav aria-label="主导航"></nav></aside><div class="jhs-ext-workspace"><header class="jhs-ext-topbar"><div id="jhs-ext-topbar-search"></div><div id="jhs-ext-topbar-meta"></div></header><p id="status" role="status">正在连接…</p><main id="content"></main></div></div><div id="jhs-ext-drawer-root" hidden></div><script src="vendors.js"></script><script src="shell.js"></script>'
            : '<header><strong>JHS</strong><nav aria-label="主导航"></nav></header><p id="status" role="status">正在连接…</p><main id="content"></main><div id="jhs-ext-drawer-root" hidden></div><script src="vendors.js"></script><script src="shell.js"></script>';
    await writeFile(join(output, `${page}.html`), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JHS</title><link rel="stylesheet" href="vendor.css"><link rel="stylesheet" href="shell.css"></head><body data-jhs-page="${page}">${ui}</body></html>\n`);
}
await writeFile(join(output, "shell.css"), await readFile(join(repoRoot, "src/platform/extension/shell.css")));
await writeFile(join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
await writeFile(join(output, "build.json"), JSON.stringify({ commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", cwd: repoRoot }).trim(), builtAt: new Date().toISOString(), channel: "extension-dev" }, null, 2) + "\n");
console.log(`Built ${output}`);
