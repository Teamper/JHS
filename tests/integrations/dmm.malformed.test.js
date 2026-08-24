// @vitest-environment jsdom
import jquery from "jquery"; import { expect, it } from "vitest"; import { parseDmmPreview } from "../../src/integrations/dmm/parser.js";
it("rejects malformed DMM preview HTML", () => { document.body.replaceChildren(); expect(() => parseDmmPreview(jquery(document), "https://www.dmm.co.jp/")).toThrow(/missing/); });
