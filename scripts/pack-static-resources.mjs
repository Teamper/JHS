import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { deflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import ts from "typescript";
import { createPackedTextReader } from "../src/core/packed-text.js";

// Reviewed owners of declarative CSS / static markup. No service data, metadata,
// external input or executable string is eligible merely because it looks like HTML.
const resourceOwners = new Set([
    "src/core/css-injection.js", "src/core/dialog-shell.js", "src/core/feedback-styles.js",
    "src/core/log-panel.js", "src/core/ui-primitives.js", "src/core/icons.js", "src/core/image-hover-preview.js", "src/core/theme.js", "src/core/ui-primitives-styles.js",
    "src/features/compatibility/compatibility-controller.js",
    "src/features/detail/detail-workspace-controller.js", "src/features/detail/detail-page-actions-controller.js", "src/features/detail/fc2-workspace-service.js",
    "src/features/detail/javbus-preview-controller.js", "src/features/detail/javdb-login-dialog.js",
    "src/features/detail/javdb-preview-controller.js", "src/features/detail/magnet-filter-controller.js",
    "src/features/detail/native-detail-media-controller.js", "src/features/detail/screenshot-controller.js",
    "src/features/discovery/new-video-styles.js", "src/features/discovery/top250-controller.js",
    "src/features/external-bridge/fc2-catalog-controller.js", "src/features/external-bridge/magnet-hub-controller.js",
    "src/features/external-sites/other-sites-controller.js",
    "src/features/identity/actress-info-controller.js", "src/features/identity/image-search-controller.js",
    "src/features/library/blacklist-styles.js", "src/features/library/blacklist-workspace-controller.js", "src/features/library/history-dialog-controller.js",
    "src/features/library/history-styles.js",
    "src/features/list/auto-page-controller.js", "src/features/list/cover-button-controller.js",
    "src/features/list/list-actions-controller.js", "src/features/list/list-batch-ui.js",
    "src/features/list/list-card-state-presenter.js", "src/features/list/list-view.js", "src/features/list/list-page-service.js", "src/features/list/list-page-filtering.js",
    "src/features/system/responsive-shell-controller.js", "src/features/system/stats-controller.js",
    "src/features/translation/translation-controller.js",
    "src/features/settings/quick-settings-controller.js", "src/features/settings/resource-settings-controller.js", "src/ui/settings/setting-panels.js",
    "src/ui/settings/setting-styles.js", "src/ui/settings/setting-templates.js",
    "src/features/discovery/new-video-dialog-view.js", "src/features/discovery/new-video-actress-list.js",
    "src/features/discovery/new-video-task-status.js", "src/features/list/list-category-fold-controller.js", "src/features/discovery/new-video-movie-list.js",
    "src/features/discovery/new-video-actress-editor.js", "src/features/discovery/new-video-actor-rebind.js",
    "src/services/layout-settings-service.js",
    "src/ui/detail/fc2-workspace-styles.js", "src/ui/detail/panel-styles.js",
    "src/ui/detail/related-panel.js", "src/ui/detail/fc2-workspace-view.js",
    "src/ui/detail/screenshot-panel.js", "src/ui/detail/magnet-results.js", "src/ui/detail/fc2-detail-workspace.js",
    "src/ui/settings/setting-control-renderer.js", "src/features/settings/setting-backup.js", "src/ui/detail/review-panel.js", "src/ui/settings/shortcut-recorder.js",
]);

function isTextLiteral(node) {
    return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function isValuePosition(node) {
    const parent = node.parent;
    if (!parent) return true;
    for (let ancestor = parent; ancestor; ancestor = ancestor.parent) {
        if (ts.isTaggedTemplateExpression(ancestor) || ts.isTemplateExpression(ancestor)) return false;
    }
    if (ts.isTaggedTemplateExpression(parent) || ts.isComputedPropertyName(parent)) return false;
    if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) return false;
    if ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)) && parent.name === node) return false;
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isLiteralTypeNode(parent)) return false;
    return !ts.isExpressionStatement(parent);
}

function isResourceText(value) {
    if (Buffer.byteLength(value, "utf8") < 64 || /<script\b|\son[a-z]+\s*=|javascript:/i.test(value)) return false;
    if (/^\s*<(?:style|div|section|table|form|span|button|article|nav|p|ul|dialog|input|label|header|select|svg|path|circle|rect|line|polyline|option|optgroup|li|a|img|main|aside|footer|textarea|dl|dt|dd|details|summary|strong|fieldset|h[1-6])\b/i.test(value)) return true;
    return /^\s*[.#:@\[]/.test(value) && /\{[^{}]*[\w-]+\s*:[^{}]+[;}]/.test(value) && /--jhs-|\.jhs-|\[data-jhs-/.test(value);
}

function templateParts(node) {
    return [node.head, ...node.templateSpans.map(span => span.literal)];
}

function isResourceTemplate(node) {
    if (!ts.isTemplateExpression(node)) return false;
    for (let parent = node.parent; parent; parent = parent.parent) {
        if (ts.isTaggedTemplateExpression(parent)) return false;
    }
    // An empty placeholder still delimits adjacent markup and CSS tokens.
    return isResourceText(templateParts(node).map(part => part.text).join(" "));
}

function staticValue(node) {
    if (isTextLiteral(node) && isValuePosition(node)) return node.text;
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const left = staticValue(node.left), right = staticValue(node.right);
        if (left !== undefined && right !== undefined) return left + right;
    }
}

function businessAstDigest(file, getterName, resources) {
    const digest = createHash("sha256");
    function packedValue(node) {
        if (getterName && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === getterName &&
            node.arguments.length === 1 && ts.isNumericLiteral(node.arguments[0])) {
            return resources[Number(node.arguments[0].text)];
        }
    }
    function writeText(value) { digest.update(JSON.stringify(["text", value])); }
    function visit(node) {
        const packed = packedValue(node);
        if (packed !== undefined) { writeText(packed); return; }
        if (ts.isTemplateExpression(node) && !ts.isTaggedTemplateExpression(node.parent)) {
            // Fold inserted text substitutions into the adjacent cooked text.
            // Every original expression remains in order with its original syntax.
            digest.update("template[");
            let accumulated = node.head.text;
            for (const span of node.templateSpans) {
                const packedPart = packedValue(span.expression);
                if (packedPart !== undefined) accumulated += packedPart;
                else {
                    writeText(accumulated);
                    visit(span.expression);
                    accumulated = "";
                }
                accumulated += span.literal.text;
            }
            writeText(accumulated);
            digest.update("]");
            return;
        }
        if (isTextLiteral(node)) {
            writeText(node.text);
            return;
        }
        digest.update(JSON.stringify([node.kind, ts.isSourceFile(node) ? null : node.text ?? null]) + "[");
        ts.forEachChild(node, child => { visit(child); });
        digest.update("]");
    }
    visit(file);
    return digest.digest("hex");
}

/** Register only reviewed, build-owned data before minification loses file provenance. */
export function collectStaticResources(path, source) {
    path = path.replaceAll("\\", "/");
    const resources = new Map();
    if (!resourceOwners.has(path)) return resources;
    const register = value => resources.set(value, new Set([path]));
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    function visit(node) {
        const value = staticValue(node);
        if (value !== undefined && isResourceText(value)) register(value);
        if (isResourceTemplate(node)) {
            for (const part of templateParts(node)) {
                if (Buffer.byteLength(part.text, "utf8") >= 32) register(part.text);
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(file);
    return resources;
}

/** Replace data values only; all surrounding business tokens and evaluation order stay intact. */
export function replaceResourceLiterals(bundle, registry) {
    const file = ts.createSourceFile("bundle.js", bundle, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const matches = [], identifiers = new Set();
    function visit(node) {
        if (ts.isIdentifier(node)) identifiers.add(node.text);
        if (isTextLiteral(node) && isValuePosition(node) && registry.has(node.text)) {
            matches.push({ start: node.getStart(file), end: node.end, value: node.text });
        } else if (isResourceTemplate(node)) {
            for (const part of templateParts(node)) {
                if (registry.has(part.text)) matches.push({
                    start: part.getStart(file) + 1,
                    end: part.end - (ts.isTemplateTail(part) ? 1 : 2),
                    value: part.text, template: true,
                });
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(file);
    matches.sort((left, right) => left.start - right.start);
    let getterName = "__jhsStaticText";
    while (identifiers.has(getterName)) getterName += "$";
    let codecName = "__jhsStaticTextCodec";
    while (identifiers.has(codecName)) codecName += "$";
    const resources = [...new Set(matches.map(match => match.value))].sort();
    const ids = new Map(resources.map((value, index) => [value, index]));
    const replacements = matches.map(match => ({ ...match, id: ids.get(match.value) }));
    let code = bundle;
    for (const replacement of [...replacements].reverse()) {
        // Minified keywords can directly abut quoted literals: return"css".
        // Delimit the replacement before reparsing so return/throw/typeof stay keywords.
        const lookup = `${getterName}(${replacement.id})`;
        const insert = replacement.template ? "${" + lookup + "}" : ` ${lookup} `;
        code = code.slice(0, replacement.start) + insert + code.slice(replacement.end);
    }
    const rewritten = ts.createSourceFile("packed-business.js", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    if (businessAstDigest(file) !== businessAstDigest(rewritten, getterName, resources)) {
        throw new Error("Static resource rewrite changed business syntax");
    }
    return { code, resources, replacements, getterName, codecName };
}

const codecBuilds = new Map();
async function buildCodec(globalName) {
    if (!codecBuilds.has(globalName)) {
        codecBuilds.set(globalName, esbuild.build({
            entryPoints: [fileURLToPath(new URL("../src/core/packed-text.js", import.meta.url))],
            bundle: true, write: false, minify: true, format: "iife", globalName,
            target: "es2020", charset: "utf8", legalComments: "none", logLevel: "silent",
        }).then(result => result.outputFiles[0].text));
    }
    return codecBuilds.get(globalName);
}

/** Embed only data plus a synchronous decoder; no loader, remote code or runtime storage. */
export async function packStaticResources(bundle, registry) {
    const replaced = replaceResourceLiterals(bundle, registry);
    if (!replaced.resources.length) return { code: bundle, resources: [], payload: "", license: "", report: { resourceCount: 0 } };
    const serialized = JSON.stringify(replaced.resources);
    const compressed = deflateRawSync(Buffer.from(serialized, "utf8"), { level: 9 });
    const payload = compressed.toString("base64"), codec = await buildCodec(replaced.codecName);
    const readPackedText = createPackedTextReader(payload, replaced.resources.length);
    for (const [index, text] of replaced.resources.entries()) {
        if (readPackedText(index) !== text) throw new Error(`Static text build roundtrip failed: ${index}`);
    }
    const [packageSource, licenseSource] = await Promise.all([
        readFile(new URL("../node_modules/fflate/package.json", import.meta.url), "utf8"),
        readFile(new URL("../node_modules/fflate/LICENSE", import.meta.url), "utf8"),
    ]);
    if (JSON.parse(packageSource).version !== "0.8.3") throw new Error("Static text decoder must be pinned to fflate 0.8.3");
    const license = `fflate 0.8.3 — https://github.com/101arrowz/fflate\n${licenseSource.trimEnd()}`;
    const wrapped = `(()=>{${codec}\nconst ${replaced.getterName}=${replaced.codecName}.createPackedTextReader(${JSON.stringify(payload)},${replaced.resources.length});\n${replaced.code}\n})();`;
    const optimized = await esbuild.transform(wrapped, {
        minify: true, target: "es2020", charset: "utf8", legalComments: "none", logLevel: "silent",
    });
    const report = {
        resourceCount: replaced.resources.length,
        referenceCount: replaced.replacements.length,
        literalBytes: replaced.replacements.reduce((sum, item) => sum + Buffer.byteLength(bundle.slice(item.start, item.end)), 0),
        serializedBytes: Buffer.byteLength(serialized), encodedBytes: payload.length, decoderBytes: Buffer.byteLength(codec),
        licenseBytes: Buffer.byteLength(`/* ${license} */\n\n`),
        bodyBytesBefore: Buffer.byteLength(bundle), bodyBytesAfter: Buffer.byteLength(optimized.code),
        resources: replaced.resources.map((value, id) => ({
            id, bytes: Buffer.byteLength(value), sha256: createHash("sha256").update(value).digest("hex"),
            owners: [...registry.get(value)].sort(), references: replaced.replacements.filter(item => item.id === id).length,
        })),
    };
    return { code: optimized.code, resources: replaced.resources, payload, license, report };
}
