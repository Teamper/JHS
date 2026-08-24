// @vitest-environment jsdom
import jquery from "jquery"; import { expect, it } from "vitest"; import { parseFc2PpvDbDetail } from "../../src/integrations/fc2ppvdb/parser.js";
it("rejects malformed FC2PPVDB HTML", () => { document.body.replaceChildren(); expect(() => parseFc2PpvDbDetail(jquery(document), "https://fc2ppvdb.com/articles/12345")).toThrow(/malformed/); });
