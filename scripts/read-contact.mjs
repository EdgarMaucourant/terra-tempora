// Reads the email of a visitor who offered to help with their report.
// `npm run read-contact`, then paste the sealed text from the issue
// (it starts with "tt1:"; pasting the whole issue works too) and press
// Enter on an empty line. Or pass it as an argument, or pipe it in.
//
// Uses the private key made by `npm run contact-key`, from
// .keys/contact-private.pem or the path in CONTACT_PRIVATE_KEY. Nothing is
// sent anywhere: the email is only printed here.
import { constants, createPrivateKey, createPublicKey, privateDecrypt } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { PRIVATE_KEY, SEALED, ask, keyId } from "./contactCrypto.mjs";

if (!existsSync(PRIVATE_KEY)) {
  console.error(`No private key at ${PRIVATE_KEY}. Make one with \`npm run contact-key\`, or set CONTACT_PRIVATE_KEY to its path.`);
  process.exit(1);
}

async function readInput() {
  const args = process.argv.slice(2).join(" ");
  if (args) return args;
  if (!process.stdin.isTTY) return readFileSync(0, "utf8");
  console.log("Paste the sealed email (or the whole issue), then press Enter on an empty line:");
  const rl = createInterface({ input: process.stdin });
  const lines = [];
  for await (const line of rl) {
    if (!line.trim() && lines.length) break;
    lines.push(line);
  }
  rl.close();
  return lines.join("\n");
}

const sealed = [...(await readInput()).matchAll(SEALED)];
if (!sealed.length) {
  console.error('No sealed email found: it starts with "tt1:".');
  process.exit(1);
}

const pem = readFileSync(PRIVATE_KEY, "utf8");
let key;
try {
  key = createPrivateKey(pem);
} catch {
  if (!process.stdin.isTTY) {
    console.error("The key needs its passphrase: give the sealed text as an argument instead of piping it in.");
    process.exit(1);
  }
  try {
    key = createPrivateKey({ key: pem, passphrase: await ask("Passphrase: ", true) });
  } catch {
    console.error("Wrong passphrase.");
    process.exit(1);
  }
}
const ours = keyId(createPublicKey(key).export({ type: "spki", format: "der" }));

for (const [, id, data] of sealed) {
  if (id !== ours) {
    console.error(`Sealed with key ${id}, but ${PRIVATE_KEY} is key ${ours}.`);
    process.exitCode = 1;
    continue;
  }
  try {
    const email = privateDecrypt(
      { key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      Buffer.from(data.replace(/\s/g, ""), "base64"),
    ).toString("utf8");
    console.log(email);
  } catch {
    console.error("This sealed email could not be opened (cut short when copied?).");
    process.exitCode = 1;
  }
}
