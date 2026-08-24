import { expect, it } from "vitest";
import { parseGoogleTranslation } from "../../src/integrations/google-translate/parser.js";

it("rejects malformed translation responses", () => {
    expect(() => parseGoogleTranslation({ translation: "" })).toThrow("text is missing");
    expect(() => parseGoogleTranslation([])).toThrow("response is invalid");
});
