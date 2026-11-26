import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Reads fixtures unchanged and lowers legacy VM-loaded production modules to script syntax.
 * New architecture tests must import modules directly; this adapter exists only for pre-6.5 VM harnesses.
 */
export function readTestFile(file, encoding) {
    const source = readFileSync(file, encoding);
    const normalized = path.resolve(file).replaceAll("\\", "/");
    if (!normalized.includes("/src/") || !normalized.endsWith(".js") || typeof source !== "string") return source;
    return source
        .replace(/^\s*import\s+[^;]+;\s*$/gm, "")
        .replace(/^export\s+(?=(?:const|let|var|class|function|async\s+function)\b)/gm, "");
}
