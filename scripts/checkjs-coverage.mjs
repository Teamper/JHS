import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(rootDir, "src");
const configPath = path.join(rootDir, "tsconfig.architecture.json");
const exceptionsPath = path.join(rootDir, "checkjs-exceptions.json");
const allowedExceptionCategories = new Set(["compatibility-glue", "vendor-glue"]);

async function listFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const result = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(directory, entry.name);
        return entry.isDirectory() ? listFiles(fullPath) : entry.name.endsWith(".js") ? [fullPath] : [];
    }));
    return result.flat();
}

const files = await listFiles(srcDir);
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, rootDir);
const compiledFiles = new Set(parsed.fileNames.map((file) => path.resolve(file)));
const checked = [];
const unchecked = [];
for (const file of files) {
    const source = await readFile(file, "utf8");
    if (compiledFiles.has(path.resolve(file)) && /^\s*\/\/\s*@ts-check\b/m.test(source)) checked.push(file);
    if (!/^\s*\/\/\s*@ts-check\b/m.test(source)) unchecked.push(path.relative(rootDir, file).replaceAll("\\", "/"));
}
const exceptionConfig = JSON.parse(await readFile(exceptionsPath, "utf8"));
const exceptions = Array.isArray(exceptionConfig.exceptions) ? exceptionConfig.exceptions : [];
const exceptionFiles = new Set();
for (const exception of exceptions) {
    if (!exception || typeof exception.file !== "string" || exceptionFiles.has(exception.file)) throw new Error("checkJs exceptions must have unique file paths");
    if (!allowedExceptionCategories.has(exception.category)) throw new Error(`Invalid checkJs exception category for ${exception.file}`);
    if (typeof exception.reason !== "string" || !exception.reason.trim()) throw new Error(`Missing checkJs exception reason for ${exception.file}`);
    if (!/^\d+\.\d+$/.test(exception.removalVersion || "")) throw new Error(`Invalid checkJs exception removalVersion for ${exception.file}`);
    exceptionFiles.add(exception.file);
}
const undeclared = unchecked.filter((file) => !exceptionFiles.has(file));
const stale = [...exceptionFiles].filter((file) => !unchecked.includes(file));
if (undeclared.length || stale.length) throw new Error(`checkJs exception mismatch (undeclared: ${undeclared.join(", ") || "none"}; stale: ${stale.join(", ") || "none"})`);
const coverage = files.length === 0 ? 100 : (checked.length / files.length) * 100;
const required = Number(process.env.JHS_CHECKJS_MIN ?? 95);
if (coverage + Number.EPSILON < required) {
    throw new Error(`checkJs coverage ${coverage.toFixed(1)}% is below ${required}%`);
}
console.log(`checkJs coverage: ${checked.length}/${files.length} (${coverage.toFixed(1)}%, required ${required}%; ${compiledFiles.size} source files compiled; ${exceptions.length} registered glue exceptions)`);
