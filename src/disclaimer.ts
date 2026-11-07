// The note on the site: a free, amateur project still under construction,
// with wrong borders being fixed and parts of history still missing, then a
// way to report a mistake. Shown in the "New here?" prompt and on the home
// side panel.

import { el } from "./dom";
import { t } from "./i18n";

/** The note, with "report it" on its own line as a button that opens the report form. */
export function disclaimer(report: () => void): HTMLParagraphElement {
  const note = el("p", "disclaimer");
  note.setAttribute("role", "note");
  note.setAttribute("aria-label", t("disclaimer.label"));
  const [before, after = ""] = t("disclaimer.reportLine").split("{report}");
  const button = el("button", "disclaimer-report", t("disclaimer.report"));
  button.type = "button";
  button.addEventListener("click", report);
  note.append(t("disclaimer.text"), el("br"), before, button, after);
  return note;
}
