# Interface text

Every word of the interface lives here, one file per language: `en.json`
(English, the reference), `fr.json` (French) and `es.json` (Spanish). All
files have the same sections, in the same order. To change a text, edit it in
every file.

## How a file is laid out

Messages are grouped in sections, and a section can hold smaller sections:

```json
"home": {
  "panel": {
    "welcome": "Welcome to",
    "intro": "This is an amateur website…"
  }
}
```

The code names a message by its path through the sections, here
`home.panel.welcome`. So you can change the text freely, but don't rename or
move a key unless you change the code that uses it too.

- `{name}`, `{year}`, `{count}`… are filled in by the app. Keep them in the
  translation (you can move them in the sentence).
- A message that depends on a number has one text per plural form:
  `{"one": "{count} civilization", "other": "{count} civilizations"}`.
- A few messages hold HTML links (`sources.list`, `landing.footer`); keep the
  `<a …>` tags intact.
- A message missing from `fr.json` or `es.json` shows in English.
- Links to the privacy notice point to the page in the same language:
  `privacy.html`, `privacy-fr.html` or `privacy-es.html`.

## Sections, in the order they appear in the files

| Section | Where it shows |
| --- | --- |
| `page`, `language`, `common` | Browser tab title, language menu, shared buttons |
| `about` | The About pop-up, opened by the ? button beside the language menu (`about.credit` also closes the home panel) |
| `status`, `hint` | Loading messages and the notes about years with no borders |
| `home` | The welcome panel at start (`home.panel`, and `home.modes` for its four modes) and the short texts of the left menu |
| `landing` | The Explore page: civilizations, countries and nations lists |
| `sort` | Sort menus on the Explore page |
| `travel` | History travel |
| `masthead`, `toolbar` | Title at the top left and the tools under it |
| `view`, `axis`, `projection`, `globe`, `map` | Globe and map views and their settings |
| `panel`, `welcome`, `tour`, `overview` | The side panel on the right, the small "New here?" prompt shown at start, and the guided tour it offers (`tour.*.phone` are the phone versions of its texts) |
| `info`, `event`, `kind` | Realm details, event cards and the kinds of events |
| `docs`, `media`, `picture` | Documentaries, photos and videos |
| `timeline`, `controls`, `lanes` | The timeline at the bottom, play controls and its rows |
| `era`, `year` | Era names and how years are written |
| `tooltip`, `picker` | Hover labels and the civilization picker |
| `sources`, `github`, `support`, `feedback` | The Sources panel, the GitHub link, the Support pop-up (Ko-fi, GitHub Sponsors and the kind-word form) and the feedback form |

## Checking your edits

Run `npm run check`. It reports invalid JSON, a French or Spanish key the English file
doesn't have (usually a typo in a key name), a `{placeholder}` the English
doesn't use, and keys in `index.html` that no longer exist. `npm run build`
also checks every key the code uses. The same checks run on each pull request.
