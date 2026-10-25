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
    "src/features/detail/native-detail-media-controller.js", "src/features/identity/image-search-controller.js",
    "src/features/external-bridge/magnet-hub-controller.js", "src/features/list/auto-page-controller.js",
    "src/features/list/list-batch-ui.js", "src/features/translation/translation-controller.js",
    "src/core/logger.js", "src/core/css-injection.js",
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
        const values = [], replacements = [];
        function visit(node) {
            let value;
            if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) &&
                (/(?:_STYLES|_CSS)$/.test(node.name.text) || path === "src/core/css-injection.js" && node.name.text === "F")) {
                value = node.initializer;
            } else if (path === "src/core/logger.js" && ts.isBinaryExpression(node) &&
                node.operatorToken.kind === ts.SyntaxKind.EqualsToken && node.left.getText(file) === "style.textContent") {
                value = node.right;
            }
            if (value && (ts.isNoSubstitutionTemplateLiteral(value) || ts.isStringLiteral(value))) values.push(value);
            ts.forEachChild(node, visit);
        }
        visit(file);
        for (const value of values) {
            replacements.push({ start: value.getStart(file), end: value.end, text: JSON.stringify(await compactCss(value.text)) });
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
