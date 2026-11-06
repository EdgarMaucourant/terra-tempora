// The note on the map's accuracy: an amateur project, borders that are
// approximations, errors fixed as they are found, and a way to report one.
// Shown in the "New here?" prompt and on the home side panel.

import { el } from "./dom";
import { t } from "./i18n";

/** The note, with "report it" as a button that opens the report form. */
export function disclaimer(report: () => void): HTMLParagraphElement {
  const note = el("p", "disclaimer");
  note.setAttribute("role", "note");
  note.setAttribute("aria-label", t("disclaimer.label"));
  const [before, after = ""] = t("disclaimer.text").split("{report}");
  const button = el("button", "disclaimer-report", t("disclaimer.report"));
  button.type = "button";
  button.addEventListener("click", report);
  note.append(before, button, after);
  return note;
}
