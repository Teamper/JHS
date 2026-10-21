import { transform } from "esbuild";
import ts from "typescript";
import { buildThemeCss } from "../src/core/theme.js";
import { buildUiPrimitivesCss } from "../src/core/ui-primitives.js";
import { buildDetailPanelCss } from "../src/ui/detail/panel-styles.js";

const builders = new Map([
    ["src/core/theme.js", ["buildThemeCss", buildThemeCss]],
    ["src/core/ui-primitives.js", ["buildUiPrimitivesCss", buildUiPrimitivesCss]],
    ["src/ui/detail/panel-styles.js", ["buildDetailPanelCss", buildDetailPanelCss]],
]);
const staticStyleFiles = new Set([
    "src/features/discovery/new-video-styles.js", "src/features/library/history-styles.js",
    "src/features/library/blacklist-styles.js", "src/ui/detail/fc2-workspace-styles.js",
    "src/plugins/backup/setting-styles.js", "src/ui/settings/shortcut-recorder.js",
    "src/features/detail/detail-shortcut-controller.js",
    "src/features/system/responsive-shell-controller.js", "src/features/list/cover-button-controller.js",
    "src/features/detail/javbus-preview-controller.js",
]);

/** Keep the existing style envelope while compacting CSS with the build's CSS parser. */
export async function compactCss(css) {
    const envelope = css.match(/^\s*(<style\b[^>]*>)([\s\S]*)(<\/style>)\s*$/i);
    const result = await transform(envelope ? envelope[2] : css, {
        loader: "css", minifyWhitespace: true, legalComments: "none", logLevel: "silent",
    });
    if (result.warnings.length) throw new Error(`Core CSS could not be compacted: ${result.warnings[0].text}`);
    return envelope ? `${envelope[1]}${result.code.trimEnd()}${envelope[3]}` : result.code.trimEnd();
}

/** Pure core styles are evaluated once at build time; runtime theme variables remain CSS variables. */
export async function prebuildStyles(path, source) {
    path = path.replaceAll("\\", "/");
    const entry = builders.get(path);
    if (!entry && !staticStyleFiles.has(path)) return source;
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    if (!entry) {
        const replacements = [];
        for (const statement of file.statements) {
            if (!ts.isVariableStatement(statement)) continue;
            for (const declaration of statement.declarationList.declarations) {
                const value = declaration.initializer;
                if (value && ts.isIdentifier(declaration.name) && declaration.name.text.endsWith("_STYLES") &&
                    (ts.isNoSubstitutionTemplateLiteral(value) || ts.isStringLiteral(value))) {
                    replacements.push({ start: value.getStart(file), end: value.end, text: JSON.stringify(await compactCss(value.text)) });
                }
            }
        }
        for (const replacement of replacements.reverse()) source = source.slice(0, replacement.start) + replacement.text + source.slice(replacement.end);
        return source;
    }
    const [name, build] = entry;
    const declaration = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    if (!declaration?.body) throw new Error(`Missing pure CSS builder: ${path}:${name}`);
    const css = await compactCss(build());
    return `${source.slice(0, declaration.body.getStart(file))}{ return ${JSON.stringify(css)}; }${source.slice(declaration.body.end)}`;
}
