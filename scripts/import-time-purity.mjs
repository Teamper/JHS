import ts from "typescript";

const DIRECT_EFFECT_CALLS = new Set([
    "$",
    "fetch",
    "GM_xmlhttpRequest",
    "setTimeout",
    "setInterval",
    "requestAnimationFrame",
    "requestIdleCallback"
]);
const EFFECT_ROOTS = new Set(["document", "window", "localStorage", "storageManager", "gmHttp"]);
const GLOBAL_ASSIGNMENT_ROOTS = new Set(["document", "window", "globalThis", "localStorage"]);
const EFFECT_METHODS = new Set(["addEventListener", "observe"]);
const EFFECT_CONSTRUCTORS = new Set(["MutationObserver", "IntersectionObserver"]);

function rootIdentifier(expression) {
    let current = expression;
    while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) current = current.expression;
    return ts.isIdentifier(current) ? current.text : "";
}

function isFunctionNode(node) {
    return ts.isArrowFunction(node)
        || ts.isFunctionExpression(node)
        || ts.isFunctionDeclaration(node)
        || ts.isMethodDeclaration(node)
        || ts.isGetAccessorDeclaration(node)
        || ts.isSetAccessorDeclaration(node)
        || ts.isConstructorDeclaration(node);
}

function unwrapParentheses(expression) {
    let current = expression;
    while (ts.isParenthesizedExpression(current)) current = current.expression;
    return current;
}

function findImportTimeEffect(node) {
    if (ts.isCallExpression(node)) {
        const invoked = unwrapParentheses(node.expression);
        if (ts.isArrowFunction(invoked) || ts.isFunctionExpression(invoked)) return findImportTimeEffect(invoked.body);
    }
    if (isFunctionNode(node) || ts.isClassExpression(node) || ts.isClassDeclaration(node)) return null;
    if (ts.isCallExpression(node)) {
        const root = rootIdentifier(node.expression);
        const method = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : "";
        if (DIRECT_EFFECT_CALLS.has(root) || EFFECT_ROOTS.has(root) || EFFECT_METHODS.has(method)) return node;
    }
    if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && EFFECT_ROOTS.has(rootIdentifier(node))) return node;
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && EFFECT_CONSTRUCTORS.has(node.expression.text)) return node;
    if (ts.isBinaryExpression(node)
        && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
        && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
        && GLOBAL_ASSIGNMENT_ROOTS.has(rootIdentifier(node.left))) return node;

    let finding = null;
    ts.forEachChild(node, (child) => { finding ||= findImportTimeEffect(child); });
    return finding;
}

/** Returns import-time side effects found in executable module-level initializers. */
export function scanImportTimeEffects(source, fileName = "module.js") {
    const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const violations = [];
    for (const statement of sourceFile.statements) {
        const roots = [];
        if (ts.isExpressionStatement(statement) || ts.isExportAssignment(statement)) roots.push(statement.expression);
        if (ts.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
                if (declaration.initializer) roots.push(declaration.initializer);
            }
        }
        for (const root of roots) {
            const effect = findImportTimeEffect(root);
            if (!effect) continue;
            const position = sourceFile.getLineAndCharacterOfPosition(effect.getStart());
            violations.push({
                line: position.line + 1,
                column: position.character + 1,
                effect: effect.getText(sourceFile)
            });
        }
    }
    return violations;
}
