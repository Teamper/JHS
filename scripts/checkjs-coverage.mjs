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
const unchecked = [];
for (const file of files) {
    const source = await readFile(file, "utf8");
    if (!compiledFiles.has(file) || /^\s*\/\/\s*@ts-nocheck\b/m.test(source)) {
        unchecked.push(path.relative(rootDir, file).replaceAll("\\", "/"));
    }
}
if (unchecked.length) throw new Error(`Source files excluded from checkJs:\n${unchecked.join("\n")}`);
if (!parsed.options.checkJs) throw new Error("The source configuration must enable checkJs");
console.log(`checkJs coverage: ${files.length}/${files.length} (100%, 0 exceptions)`);
