// @vitest-environment jsdom
import { readFileSync } from "node:fs"; import { join } from "node:path"; import jquery from "jquery"; import { expect, it } from "vitest"; import { parseFc2PpvDbDetail } from "../../src/integrations/fc2ppvdb/parser.js";
it("normalizes an FC2PPVDB detail", () => { document.documentElement.innerHTML = readFileSync(join(import.meta.dirname, "../fixtures/integrations/fc2ppvdb/detail.html"), "utf8"); expect(parseFc2PpvDbDetail(jquery(document), "https://fc2ppvdb.com/articles/12345")).toMatchObject({ carNum: "FC2-12345", title: "Fixture FC2 title" }); });
