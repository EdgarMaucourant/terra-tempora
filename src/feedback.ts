// Visitors' reports: an error, missing data or an idea, about whatever they
// were looking at. The form sends the message with that context to the
// Worker (worker/index.js), which files it as a GitHub issue. Visitors who
// offer to help leave an email, encrypted here with the maintainers' public
// key (src/contactKey.ts) so that only the sealed text reaches the Worker and
// GitHub; `npm run read-contact` opens it.

import { CONTACT_KEY } from "./contactKey";
import { externalLink } from "./dom";
import { lang, t } from "./i18n";
import { formatYear } from "./years";

interface FeedbackContext {
  /** What the report is about. */
  kind: "realm" | "event" | "turning-point" | "place" | "app";
  /** The item's id, e.g. a civilization or event id. */
  id?: string;
  /** Its name as shown, e.g. "Battle of Mohi". */
  name?: string;
  year?: number;
  lonLat?: [number, number] | null;
}

declare const __APP_VERSION__: string;

// A Cloudflare Turnstile site key, set at build time, turns on the bot check.
export const TURNSTILE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

export interface Turnstile {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
}

let turnstileLoading: Promise<Turnstile> | undefined;
export function loadTurnstile(): Promise<Turnstile> {
  turnstileLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve((window as unknown as { turnstile: Turnstile }).turnstile);
    script.onerror = reject;
    document.head.append(script);
  });
  return turnstileLoading;
}

/**
 * Seals an email with the maintainers' public key (RSA-OAEP, SHA-256), as
 * "tt1:<key id>:<base64>". scripts/read-contact.mjs opens it.
 */
async function sealEmail(email: string): Promise<string> {
  const key = CONTACT_KEY!;
  const der = Uint8Array.from(atob(key.spki), (c) => c.charCodeAt(0));
  const publicKey = await crypto.subtle.importKey("spki", der, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const sealed = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, new TextEncoder().encode(email));
  return `tt1:${key.id}:${btoa(String.fromCharCode(...new Uint8Array(sealed)))}`;
}

/**
 * The link back to what the visitor saw. For a spot they pointed at, it
 * carries the spot (p=<lon>,<lat>) and the year, so the app pins it.
 */
function viewUrl(c: FeedbackContext): string {
  const url = new URL(location.href);
  if (c.kind !== "place" || !c.lonLat) return url.href;
  // An old-style #y1241 link becomes #y=1241.
  const params = new URLSearchParams(url.hash.replace(/^#y(-?\d)/, "#y=$1").slice(1));
  params.delete("travel");
  params.set("p", c.lonLat.map((n) => n.toFixed(3)).join(","));
  if (c.year !== undefined) params.set("y", String(Math.round(c.year)));
  url.hash = params.toString().replace(/%2C/g, ",");
  return url.href;
}

/** The report dialog. */
export class Feedback {
  private form: HTMLFormElement;
  private status: HTMLElement;
  private send: HTMLButtonElement;
  private cancel: HTMLButtonElement;
  private help: HTMLInputElement;
  private email: HTMLInputElement;
  private context: FeedbackContext = { kind: "app" };
  private returnFocus: HTMLElement | null = null;
  private token = "";
  private widget: string | null = null;

  constructor(private root: HTMLElement) {
    this.form = root.querySelector("form")!;
    this.status = root.querySelector("#feedback-status")!;
    this.send = root.querySelector("#feedback-send")!;
    this.cancel = root.querySelector(".picker-foot [data-close]")!;
    this.help = root.querySelector("input[name=help]")!;
    this.email = root.querySelector("input[name=email]")!;
    // The offer to help needs a key to seal the email with, and a browser that can.
    root.querySelector<HTMLElement>("#feedback-help")!.hidden = !CONTACT_KEY || !crypto.subtle;
    this.help.addEventListener("change", () => this.showEmail());
    for (const button of root.querySelectorAll("[data-close]")) button.addEventListener("click", () => this.close());
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        this.close();
      }
    });
    root.addEventListener("click", (e) => {
      if (e.target === root) this.close();
    });
    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      void this.submit();
    });
  }

  open(context: FeedbackContext) {
    this.context = context;
    this.returnFocus = document.activeElement as HTMLElement | null;
    const about = this.root.querySelector<HTMLElement>("#feedback-about")!;
    about.textContent = context.name
      ? t("feedback.about", { name: context.name })
      : context.kind === "place" && context.year !== undefined
        ? t("feedback.aboutPlace", { year: formatYear(context.year) })
        : t("feedback.aboutApp");
    this.form.reset();
    this.showEmail();
    this.status.textContent = "";
    this.send.disabled = false;
    this.send.hidden = false;
    this.cancel.textContent = t("common.cancel");
    this.root.hidden = false;
    this.form.querySelector("textarea")!.focus();
    if (TURNSTILE_KEY) void this.showTurnstile();
  }

  private showEmail() {
    this.email.closest("label")!.hidden = !this.help.checked;
    this.email.required = this.help.checked;
  }

  close() {
    this.root.hidden = true;
    this.returnFocus?.focus();
  }

  private async showTurnstile() {
    try {
      const turnstile = await loadTurnstile();
      if (this.widget !== null) return turnstile.reset(this.widget);
      this.widget = turnstile.render(this.root.querySelector<HTMLElement>("#feedback-turnstile")!, {
        sitekey: TURNSTILE_KEY,
        language: lang,
        theme: "dark",
        callback: (token: string) => (this.token = token),
        "expired-callback": () => (this.token = ""),
      });
    } catch {
      this.status.textContent = t("feedback.checkFailed");
    }
  }

  private async submit() {
    const data = new FormData(this.form);
    const message = String(data.get("message") ?? "").trim();
    if (message.length < 10) {
      this.status.textContent = t("feedback.tooShort");
      return;
    }
    const email = this.help.checked ? this.email.value.trim() : "";
    if (this.help.checked && !this.email.checkValidity()) {
      this.status.textContent = t("feedback.emailInvalid");
      this.email.focus();
      return;
    }
    if (TURNSTILE_KEY && !this.token) {
      this.status.textContent = t("feedback.waitCheck");
      return;
    }
    this.send.disabled = true;
    this.status.textContent = t("feedback.sending");
    const c = this.context;
    let contact: string | undefined;
    try {
      contact = email ? await sealEmail(email) : undefined;
    } catch (error) {
      console.error("The email could not be encrypted.", error);
      this.status.textContent = t("feedback.failed");
      this.send.disabled = false;
      return;
    }
    const body = {
      type: data.get("type"),
      message,
      contact,
      website: data.get("website"),
      turnstile: this.token,
      context: {
        kind: c.kind,
        id: c.id,
        name: c.name,
        year: c.year,
        lonLat: c.lonLat ?? undefined,
        url: viewUrl(c),
        lang,
        screen: `${window.innerWidth}×${window.innerHeight}`,
        version: __APP_VERSION__,
      },
    };
    try {
      const response = await fetch(new URL("api/feedback", document.baseURI), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(String(response.status));
      const sent = (await response.json().catch(() => ({}))) as { url?: unknown };
      const issue = typeof sent.url === "string" && sent.url.startsWith("https://github.com/") ? sent.url : "";
      if (issue) {
        // The report is now a public GitHub issue: the visitor can follow it
        // there, so the dialog stays open with the link until they close it.
        this.status.replaceChildren(t("feedback.thanks"), " ", externalLink(issue, t("feedback.seeIssue")));
        this.send.hidden = true;
        this.cancel.textContent = t("common.close");
      } else {
        this.status.textContent = t("feedback.thanks");
        window.setTimeout(() => {
          if (!this.root.hidden) this.close();
        }, 1800);
      }
    } catch (error) {
      console.error("The report could not be sent.", error);
      this.status.textContent = String(error).includes("429") ? t("feedback.tooMany") : t("feedback.failed");
      this.send.disabled = false;
    } finally {
      this.token = "";
      if (this.widget !== null) loadTurnstile().then((ts) => ts.reset(this.widget!));
    }
  }
}
