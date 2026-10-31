// The Support pop-up: a tip on Ko-fi, a sponsorship on GitHub, or a kind word
// for the author. Ko-fi and GitHub are plain links, so nothing loads from
// those sites until the visitor follows one. The kind word goes to the
// Worker (POST /api/message), which emails it privately to the author, with
// the visitor's email (if they give one) as the address to reply to.

import { lang, t } from "./i18n";
import { loadTurnstile, TURNSTILE_KEY } from "./feedback";

export class Support {
  private form: HTMLFormElement;
  private choices: HTMLElement;
  private write: HTMLElement;
  private status: HTMLElement;
  private back: HTMLButtonElement;
  private send: HTMLButtonElement;
  private closeButton: HTMLButtonElement;
  private message: HTMLTextAreaElement;
  private email: HTMLInputElement;
  private returnFocus: HTMLElement | null = null;
  private token = "";
  private widget: string | null = null;

  constructor(private root: HTMLElement) {
    this.form = root.querySelector("form")!;
    this.choices = root.querySelector(".support-choices")!;
    this.write = root.querySelector(".support-write")!;
    this.status = root.querySelector("#support-status")!;
    this.back = root.querySelector("#support-back")!;
    this.send = root.querySelector("#support-send")!;
    this.closeButton = root.querySelector("#support-close")!;
    this.message = root.querySelector("textarea[name=message]")!;
    this.email = root.querySelector("input[name=email]")!;
    for (const button of root.querySelectorAll("[data-close]")) button.addEventListener("click", () => this.close());
    root.querySelector("#support-message")!.addEventListener("click", () => this.showForm(true));
    this.back.addEventListener("click", () => this.showForm(false));
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

  open() {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.form.reset();
    this.showForm(false);
    this.root.hidden = false;
    this.form.focus();
  }

  close() {
    this.root.hidden = true;
    this.returnFocus?.focus();
  }

  /** Switches between the three choices and the kind-word form. */
  private showForm(writing: boolean) {
    this.choices.hidden = writing;
    this.write.hidden = !writing;
    this.back.hidden = !writing;
    this.send.hidden = !writing;
    this.send.disabled = false;
    this.closeButton.hidden = writing;
    this.status.textContent = "";
    if (!writing) return this.root.querySelector<HTMLElement>("#support-message")?.blur();
    this.message.focus();
    if (TURNSTILE_KEY) void this.showTurnstile();
  }

  private async showTurnstile() {
    try {
      const turnstile = await loadTurnstile();
      if (this.widget !== null) return turnstile.reset(this.widget);
      this.widget = turnstile.render(this.root.querySelector<HTMLElement>("#support-turnstile")!, {
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
      this.status.textContent = t("support.tooShort");
      this.message.focus();
      return;
    }
    const email = this.email.value.trim();
    if (email && !this.email.checkValidity()) {
      this.status.textContent = t("support.emailInvalid");
      this.email.focus();
      return;
    }
    if (TURNSTILE_KEY && !this.token) {
      this.status.textContent = t("feedback.waitCheck");
      return;
    }
    this.send.disabled = true;
    this.status.textContent = t("feedback.sending");
    try {
      const response = await fetch(new URL("api/message", document.baseURI), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          name: String(data.get("name") ?? "").trim(),
          email: email || undefined,
          website: data.get("website"),
          turnstile: this.token,
          lang,
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
      this.status.textContent = t("support.thanks");
      this.send.hidden = true;
      this.back.hidden = true;
      this.closeButton.hidden = false;
      this.closeButton.focus();
    } catch (error) {
      console.error("The message could not be sent.", error);
      this.status.textContent = String(error).includes("429") ? t("support.tooMany") : t("support.failed");
      this.send.disabled = false;
    } finally {
      this.token = "";
      if (this.widget !== null) loadTurnstile().then((ts) => ts.reset(this.widget!));
    }
  }
}
