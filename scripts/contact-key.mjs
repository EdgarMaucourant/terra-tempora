// Makes the key pair that seals the email of visitors who offer to help with
// their report. Run it once, on your own computer: `npm run contact-key`.
//
// The private key goes to .keys/contact-private.pem (ignored by git, or the
// path in CONTACT_PRIVATE_KEY), locked with a passphrase you choose. Keep a
// copy somewhere safe, such as a password manager: without it the emails
// sealed with this key can't be read. The public key is written into
// src/contactKey.ts, which is committed so the site can encrypt with it.
//
// Refuses to replace an existing private key unless given --replace, as the
// emails sealed with the old key would then be lost.
import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PRIVATE_KEY, PUBLIC_KEY_MODULE, ask, keyId } from "./contactCrypto.mjs";

if (existsSync(PRIVATE_KEY) && !process.argv.includes("--replace")) {
  console.error(`${PRIVATE_KEY} already exists. Emails sealed with it would become unreadable if it were replaced.`);
  console.error("Run again with --replace to make a new key anyway (keep the old file to read older reports).");
  process.exit(1);
}

// The private key must never be committed: check git ignores where it goes.
try {
  execFileSync("git", ["check-ignore", "-q", PRIVATE_KEY]);
} catch {
  console.error(`git does not ignore ${PRIVATE_KEY}; refusing to write a private key where it could be committed.`);
  process.exit(1);
}

const passphrase = await ask("Passphrase for the private key (needed to read emails; empty for none): ", true);
if (passphrase && (await ask("Same passphrase again: ", true)) !== passphrase) {
  console.error("The passphrases differ; nothing was written.");
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 4096,
  publicKeyEncoding: { type: "spki", format: "der" },
  privateKeyEncoding: passphrase
    ? { type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase }
    : { type: "pkcs8", format: "pem" },
});

mkdirSync(dirname(PRIVATE_KEY), { recursive: true });
writeFileSync(PRIVATE_KEY, privateKey, { mode: 0o600 });

const id = keyId(publicKey);
writeFileSync(
  PUBLIC_KEY_MODULE,
  `// The public half of the key that seals the email of visitors who offer to
// help with their report (see src/feedback.ts). Written by
// \`npm run contact-key\`; the private half stays on the maintainer's computer
// in .keys/ and never enters the repository. While this is null the offer to
// help is hidden.

export const CONTACT_KEY: { id: string; spki: string } | null = {
  id: "${id}",
  spki: "${publicKey.toString("base64")}",
};
`,
);

console.log(`Private key: ${PRIVATE_KEY} (keep a copy somewhere safe; never commit it)`);
console.log(`Public key ${id} written to ${PUBLIC_KEY_MODULE}: commit that file and deploy.`);
