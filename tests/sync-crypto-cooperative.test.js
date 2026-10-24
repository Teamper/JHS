import { expect, it } from "vitest";
import { ComputationBudget } from "../src/core/cooperative-work.js";
import { encryptPortableBackup, decryptPortableBackup } from "../src/core/credential-crypto.js";
it("yields inside portable backup base64 conversion and stays readable by the legacy path", async () => {
  let now = 0, yields = 0;
  const work = new ComputationBudget({ clock: () => (now += 5), yieldTask: async () => { yields++; } });
  const text = "资料".repeat(65536);
  const content = await encryptPortableBackup(text, work);
  expect(yields).toBeGreaterThan(0);
  expect(await decryptPortableBackup(content)).toBe(text);
  yields = 0;
  expect(await decryptPortableBackup(content, work)).toBe(text);
  expect(yields).toBeGreaterThan(0);
});
