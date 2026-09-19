// @vitest-environment jsdom
import { readFileSync } from "node:fs"; import { join } from "node:path"; import jquery from "jquery"; import { expect, it } from "vitest"; import { parseJavTrailersPreview } from "../../src/integrations/javtrailers/parser.js";
it("normalizes a JavTrailers preview", () => { document.documentElement.innerHTML = readFileSync(join(import.meta.dirname, "../fixtures/integrations/javtrailers/preview.html"), "utf8"); expect(parseJavTrailersPreview(jquery(document), "https://javtrailers.com/").url).toBe("https://javtrailers.com/videos/sample.mp4"); });
