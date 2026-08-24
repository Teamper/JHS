import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(rootDir, "src");
const configPath = path.join(rootDir, "tsconfig.architecture.json");

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
for (const file of files) {
    const source = await readFile(file, "utf8");
    if (compiledFiles.has(path.resolve(file)) && /^\s*\/\/\s*@ts-check\b/m.test(source)) checked.push(file);
}
const coverage = files.length === 0 ? 100 : (checked.length / files.length) * 100;
const required = Number(process.env.JHS_CHECKJS_MIN ?? 84);
if (coverage + Number.EPSILON < required) {
    throw new Error(`checkJs coverage ${coverage.toFixed(1)}% is below ${required}%`);
}
console.log(`checkJs coverage: ${checked.length}/${files.length} (${coverage.toFixed(1)}%, required ${required}%; ${compiledFiles.size} source files compiled)`);
