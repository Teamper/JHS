import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { compactCss, prebuildStyles } from "../scripts/prebuild-styles.mjs";

function staticStyles(source) {
    const file = ts.createSourceFile("styles.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const styles = new Map(), spans = [];
    for (const statement of file.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
            const value = declaration.initializer;
            if (value && ts.isIdentifier(declaration.name) && declaration.name.text.endsWith("_STYLES") &&
                (ts.isNoSubstitutionTemplateLiteral(value) || ts.isStringLiteral(value))) {
                styles.set(declaration.name.text, value.text);
                spans.push([value.getStart(file), value.end]);
            }
        }
    }
    for (const [start, end] of spans.reverse()) source = source.slice(0, start) + "0" + source.slice(end);
    return { styles, logic: source };
}

describe("build-time core styles", () => {
    it("preserves CSS strings, descendant selectors, calc spacing and attributed envelopes", async () => {
        const output = await compactCss('<style id="fixture"> .parent .child { content:"a  b"; width:calc(100% - 2px); --label: a b; } </style>');
        expect(output).toContain('<style id="fixture">');
        expect(output).toContain('.parent .child');
        expect(output).toContain('"a  b"');
        expect(output).toContain('calc(100% - 2px)');
        expect(output).toContain('--label: a b');
        expect(output).toMatch(/<\/style>$/);
    });
    it("replaces only pure CSS builder bodies and retains runtime theme behavior", async () => {
        const source = await readFile(new URL('../src/core/theme.js', import.meta.url), 'utf8');
        const output = await prebuildStyles('src/core/theme.js', source);
        expect(output.length).toBeLessThan(source.length);
        expect(output).toContain('--jhs-font:');
        expect(output).toContain('var(--jhs-accent)');
        expect(output.slice(output.indexOf('export function applyThemeMode'))).toBe(source.slice(source.indexOf('export function applyThemeMode')));
    });
    it("does not transform runtime-dependent feature styles", async () => {
        const source = 'export function style(width) { return `.panel { width:${width}px }`; }';
        expect(await prebuildStyles('src/features/fixture.js', source)).toBe(source);
    });
    it("compacts only shared settings CSS and preserves per-site runtime dimensions", async () => {
        const source = (await readFile(new URL('../src/plugins/backup/setting-styles.js', import.meta.url), 'utf8')).replace(/^export \{.*\} from .*;$/m, '');
        const transformed = await prebuildStyles('src/plugins/backup/setting-styles.js', source);
        const originalModule = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
        const compiledModule = await import('data:text/javascript;base64,' + Buffer.from(transformed).toString('base64'));
        expect(source.length - transformed.length).toBeGreaterThan(3000);
        for (const args of [[80, 4, true, false], [95, 6, false, true], [90, 2, false, false]]) {
            expect(await compactCss(compiledModule.buildSettingCss(...args))).toBe(await compactCss(originalModule.buildSettingCss(...args)));
        }
    });
    it("compacts declared static feature styles while retaining interpolated styles", async () => {
        const source = 'export const STATIC_STYLES = `.parent .child { content:"a  b"; }`; export const DYNAMIC_STYLES = `.item {width:${width}px}`;';
        const output = await prebuildStyles('src/features/discovery/new-video-styles.js', source);
        expect(output).toContain('STATIC_STYLES = ".parent .child{content:\\"a  b\\"}"');
        expect(output).toContain('DYNAMIC_STYLES = `.item {width:${width}px}`');
    });
    it.each([
        "src/features/system/responsive-shell-controller.js",
        "src/features/list/cover-button-controller.js",
        "src/features/detail/javbus-preview-controller.js",
    ])("prebuilds interaction styles without changing controller logic: %s", async path => {
        const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
        const compiled = await prebuildStyles(path, source), original = staticStyles(source), transformed = staticStyles(compiled);
        expect(original.styles.size).toBeGreaterThan(0);
        expect(compiled.length).toBeLessThan(source.length);
        expect(transformed.logic).toBe(original.logic);
        expect([...transformed.styles.keys()]).toEqual([...original.styles.keys()]);
        for (const [name, css] of original.styles) expect(transformed.styles.get(name)).toBe(await compactCss(css));
    });
});
