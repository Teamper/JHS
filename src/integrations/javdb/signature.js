// @ts-check

let signatureSecond = 0;
let signatureValue = "";

/** Generate the JavDB request signature with the userscript vendor MD5 runtime. */
export function createJavDbSignature() {
    const now = Math.floor(Date.now() / 1_000);
    if (signatureValue && now - signatureSecond <= 20) return signatureValue;
    const md5Runtime = /** @type {any} */ (globalThis).md5;
    if (typeof md5Runtime !== "function") throw new Error("Missing userscript vendor runtime: md5");
    signatureSecond = now;
    signatureValue = `${now}.lpw6vgqzsp.${md5Runtime(`${now}71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa`)}`;
    return signatureValue;
}
