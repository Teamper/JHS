import { describe, expect, it } from "vitest";
import { inflateRawSync } from "node:zlib";
import vm from "node:vm";
import ts from "typescript";
import { collectStaticResources, replaceResourceLiterals, packStaticResources } from "../scripts/pack-static-resources.mjs";

const owner = "src/core/css-injection.js";
const css = '<style id="fixture">' + '.jhs-fixture .child{content:"演员  😀";width:calc(100% - 2px);--label: a b}' .repeat(16) + '</style>';
const html = '<section class="jhs-ui" aria-label="演员 &amp; 影片">' + '<label class="jhs-field-label">姓名<input class="jhs-field" value="a  b"></label>'.repeat(6) + '</section>';
const register = source => collectStaticResources(owner, source);

function structure(source, replacement) {
    const file = ts.createSourceFile("fixture.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    function visit(node) {
        if (replacement && ts.isCallExpression(node) && node.expression.getText(file) === replacement.getterName) {
            return ["text", replacement.resources[Number(node.arguments[0].text)]];
        }
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return ["text", node.text];
        const children = [];
        ts.forEachChild(node, child => { children.push(visit(child)); });
        return [node.kind, ts.isSourceFile(node) ? null : node.text ?? null, children];
    }
    return visit(file);
}

describe("build-time static resource packing", () => {
    it("only registers literal resources from explicitly owned source modules", () => {
        const source = `const css=${JSON.stringify(css)};const html=${JSON.stringify(html)};`;
        expect([...register(source).keys()]).toEqual([css, html]);
        expect(collectStaticResources("src/services/unknown-service.js", source).size).toBe(0);
        expect(register(`const data=${JSON.stringify('function run(){return "' + css + '"}')};`).size).toBe(0);
    });

    it("does not touch tagged/interpolated templates, property keys, scripts or runtime values", () => {
        const source = `const plain=${JSON.stringify(css)};const tagged=String.raw\`${css}\`;const dynamic=\`${html}\${runtimeValue}\`;const keys={[${JSON.stringify(css)}]:1};keys[${JSON.stringify(css)}]=2;const script=${JSON.stringify('<script>' + 'run();'.repeat(80) + '</script>')};`;
        const registry = register(source), replaced = replaceResourceLiterals(source, registry);
        expect(replaced.replacements).toHaveLength(1);
        expect(structure(replaced.code, replaced)).toEqual(structure(source));
        expect(replaced.code).toContain(`String.raw\`${css}\``);
        expect(replaced.code).toContain("${runtimeValue}");
    });

    it("registers adjacent static HTML concatenations without evaluating code", () => {
        const source = `const value=${JSON.stringify(html.slice(0, 70))}+${JSON.stringify(html.slice(70))};`;
        expect(register(source).has(html)).toBe(true);
    });

    it("keeps literal expressions inside tagged and interpolated templates untouched", () => {
        const source = `const plain=${JSON.stringify(css)};const tagged=String.raw\`value=\${${JSON.stringify(css)}}\`;const interpolated=\`value=\${${JSON.stringify(css)}}\`;`;
        const replaced = replaceResourceLiterals(source, register(source));
        expect(replaced.replacements).toHaveLength(1);
        expect(structure(replaced.code, replaced)).toEqual(structure(source));
    });

    it("preserves business AST, literal values and side-effect evaluation order", () => {
        const source = `let __jhsStaticText=5;globalThis.values=[${JSON.stringify(css)},(()=>{globalThis.calls++;return ${JSON.stringify(html)}})(),${JSON.stringify(css)},__jhsStaticText];`;
        const registry = register(source), replaced = replaceResourceLiterals(source, registry);
        expect(replaced.resources).toHaveLength(2);
        expect(replaced.replacements).toHaveLength(3);
        expect(replaced.getterName).not.toBe("__jhsStaticText");
        expect(structure(replaced.code, replaced)).toEqual(structure(source));
        const sandbox = { calls: 0, [replaced.getterName]: index => replaced.resources[index] };
        vm.runInNewContext(replaced.code, sandbox);
        expect(sandbox.values).toEqual([css, html, css, 5]);
        expect(sandbox.calls).toBe(1);
    });

    it("preserves lexical boundaries after minified return, throw and typeof keywords", async () => {
        const source = `globalThis.get=function(){return${JSON.stringify(css)}};globalThis.kind=typeof${JSON.stringify(html)};globalThis.make=function(){throw${JSON.stringify(css)}};globalThis.values=[get(),kind];try{make()}catch(error){globalThis.failure=error}`;
        const registry = register(source), replaced = replaceResourceLiterals(source, registry);
        expect(structure(replaced.code, replaced)).toEqual(structure(source));
        const packed = await packStaticResources(source, registry), sandbox = { atob };
        vm.runInNewContext(packed.code, sandbox);
        expect(sandbox.values).toEqual([css, "string"]);
        expect(sandbox.failure).toBe(css);
    });

    it("emits a self-contained, deterministic payload and retains no private globals", async () => {
        const source = `globalThis.values=[${JSON.stringify(css)},${JSON.stringify(html)},${JSON.stringify(css)}];`;
        const registry = register(source);
        const packed = await packStaticResources(source, registry);
        const again = await packStaticResources(source, new Map([...registry].reverse()));
        expect(packed.code).toBe(again.code);
        expect(JSON.parse(inflateRawSync(Buffer.from(packed.payload, "base64")))).toEqual(packed.resources);
        const sandbox = { atob, TextDecoder: undefined };
        vm.runInNewContext(packed.code, sandbox);
        expect(sandbox.values).toEqual([css, html, css]);
        expect(Object.keys(sandbox).sort()).toEqual(["TextDecoder", "atob", "values"].sort());
        expect(packed.report.encodedBytes).toBeLessThan(packed.report.literalBytes);
        expect(packed.license).toContain("MIT");
        expect(packed.license).toContain("0.8.3");
    });

    it("leaves bundles without eligible resources untouched", async () => {
        const source = "globalThis.value = 42;";
        const packed = await packStaticResources(source, new Map());
        expect(packed.code).toBe(source);
        expect(packed.report.resourceCount).toBe(0);
    });
});
