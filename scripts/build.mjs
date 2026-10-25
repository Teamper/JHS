import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { ICON_LICENSE } from "../src/core/icon-license.js";
import { prebuildStyles } from "./prebuild-styles.mjs";
import { collectStaticResources, packStaticResources as packResources } from "./pack-static-resources.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = join(repoRoot, "src", "main.js");
const packagePath = join(repoRoot, "package.json");
const distDir = join(repoRoot, "dist");
const distPath = join(distDir, "JHS.user.js");
const rootPath = join(repoRoot, "JHS.user.js");

export async function buildUserscript({ outputPaths = [distPath, rootPath], transformMetadata = (value) => value, transformBundle = (value) => value, packStaticResources = false } = {}) {
  const source = await readFile(srcPath, "utf8");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  const metadataMatch = source.match(/^\/\/ ==UserScript==[\s\S]*?^\/\/ ==\/UserScript==\r?\n?/m);

  if (!metadataMatch) throw new Error("Missing userscript metadata block in src/main.js");

  const sourceMetadata = metadataMatch[0].trimEnd();
  const userscriptVersion = sourceMetadata.match(/^\/\/ @version\s+(.+)$/m)?.[1];
  if (packageJson.version !== userscriptVersion) {
    throw new Error(`Version mismatch: package.json ${packageJson.version}, userscript ${userscriptVersion}`);
  }

  const metadata = transformMetadata(sourceMetadata);
  const resourceRegistry = new Map();
  const buildResult = await esbuild.build({
    entryPoints: [srcPath],
    absWorkingDir: repoRoot,
    bundle: true,
    format: "iife",
    target: "es2020",
    charset: "utf8",
    legalComments: "none",
    // Contribution manifests carry stable legacy identities, so runtime names are unnecessary.
    keepNames: false,
    minifySyntax: true,
    minifyWhitespace: true,
    minifyIdentifiers: true,
    write: false,
    metafile: true,
    logLevel: "silent",
    plugins: [{
      name: "strip-build-comments",
      setup(build) {
        build.onLoad({ filter: /src[\\/].*\.js$/ }, async (args) => {
          let contents = await readFile(args.path, "utf8");
          contents = await prebuildStyles(relative(repoRoot, args.path), contents);
          if (packStaticResources) {
            for (const [text, owners] of collectStaticResources(relative(repoRoot, args.path), contents)) {
              const registered = resourceRegistry.get(text) || new Set();
              for (const owner of owners) registered.add(owner);
              resourceRegistry.set(text, registered);
            }
          }
          if (args.path === srcPath) contents = contents.replace(/^\/\/ ==UserScript==[\s\S]*?^\/\/ ==\/UserScript==\r?\n?/m, "");
          return { contents: contents.replace(/\/\*\*[\s\S]*?\*\//g, ""), loader: "js" };
        });
      }
    }]
  });
  const rawBundle = buildResult.outputFiles[0].text.trimStart().split(/\r?\n/).map((line) => line.trimEnd()).join("\n");
  const packed = packStaticResources ? await packResources(rawBundle, resourceRegistry) : null;
  const bundledOutput = transformBundle(packed?.code ?? rawBundle);
  const decoderLicense = packed?.license ? `/* ${packed.license} */\n\n` : "";
  const output = `${metadata}\n\n/* ${ICON_LICENSE} */\n\n${decoderLicense}${bundledOutput}`;
  const outputBytes = Buffer.byteLength(output, "utf8");

  for (const outputPath of outputPaths) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, "utf8");
  }
  const modules = Object.entries(Object.values(buildResult.metafile.outputs)[0].inputs)
    .map(([path, value]) => ({ path, unpackedBytes: value.bytesInOutput }))
    .sort((left, right) => right.unpackedBytes - left.unpackedBytes);
  return { output, outputBytes, outputPaths, analysis: { outputBytes, unpackedBodyBytes: Buffer.byteLength(rawBundle), modules, packing: packed?.report ?? { resourceCount: 0 } } };
}

export { distPath, repoRoot, rootPath, srcPath };

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = await buildUserscript();
  console.log(`Built dist/JHS.user.js and JHS.user.js (${result.outputBytes} bytes)`);
}
