// Shared by the contact key scripts: where the keys live, how a sealed email
// is written in an issue, and a prompt that hides what is typed.
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";

/** The private key, outside the repository's history (.keys/ is in .gitignore). */
export const PRIVATE_KEY = process.env.CONTACT_PRIVATE_KEY || ".keys/contact-private.pem";
/** The public key the site encrypts with. */
export const PUBLIC_KEY_MODULE = "src/contactKey.ts";

/** A short name for a public key, so a sealed email says which key opens it. */
export const keyId = (spkiDer) => createHash("sha256").update(spkiDer).digest("hex").slice(0, 12);

/** Sealed emails read "tt1:<key id>:<base64>", as written by src/feedback.ts. */
export const SEALED = /tt1:([0-9a-f]{12}):([A-Za-z0-9+/=\s]+)/g;

/** Asks a question on the terminal; with `hidden`, what is typed isn't shown. */
export function ask(question, hidden = false) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
      else if (s.includes("\n")) rl.output.write("\n");
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    }),
  );
}
