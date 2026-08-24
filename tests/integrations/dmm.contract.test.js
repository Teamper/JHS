// @vitest-environment jsdom
import { readFileSync } from "node:fs"; import { join } from "node:path"; import jquery from "jquery"; import { expect, it } from "vitest"; import { parseDmmPreview } from "../../src/integrations/dmm/parser.js";
it("normalizes a DMM preview", () => { document.documentElement.innerHTML = readFileSync(join(import.meta.dirname, "../fixtures/integrations/dmm/preview.html"), "utf8"); expect(parseDmmPreview(jquery(document), "https://www.dmm.co.jp/").url).toBe("https://www.dmm.co.jp/preview/sample.mp4"); });
