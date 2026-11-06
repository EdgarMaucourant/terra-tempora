# Deployment

How the site is hosted on Cloudflare, and how to turn on the Worker features: reports, kind words and usage counts.

## Hosting

The site is static: `npm run build` writes it to `dist/` (about 170 files,
33 MB, none over 2 MB), and every data file downloads only when needed. It is
served by Cloudflare Workers as static files (`wrangler.jsonc`), which costs
nothing on the free plan:

1. In Cloudflare, Workers & Pages → Create → Import a repository, and pick
   this repository.
2. Build command: `npm run build`. Deploy command: `npx wrangler deploy`.
   Node is read from `.node-version`.
3. Every push to `main` publishes the site; other branches get a preview
   address to test before publishing.

`public/_headers` sets the security headers and how long browsers keep files:
built scripts forever (their names change with their content), data files an
hour. Its Content Security Policy lists every site the app loads from (its own
files, Wikipedia, Wikidata, Wikimedia Commons and Cloudflare Turnstile); a new
outside source must be added there, or the browser blocks it. The fonts are
served with the site (`@fontsource-variable`), so no request goes to Google.

To require a review before anything is published, in GitHub's Settings →
Branches, add a rule for `main`: require a pull request with one approval,
require review from Code Owners (`.github/CODEOWNERS`), and require the
"Check" status to pass.

## Search engines and link previews

What search engines, AI assistants and social sites read about the site:

- `index.html` head: title, description, canonical address, the three
  languages (`hreflang`: `/`, `/?lang=fr`, `/?lang=es`), Open Graph and
  Twitter/Mastodon preview lines, and JSON-LD (the website, the app, its
  publisher and the border dataset). A `<noscript>` block describes the site
  for crawlers that don't run scripts.
- `worker/index.js` swaps the language lines (title, description, canonical,
  preview text and picture) for `/?lang=fr` and `/?lang=es`, which is why
  `run_worker_first` in `wrangler.jsonc` includes `/`. When the English text
  in `index.html` changes, change `HOME_TEXT` there and `page.home` in the
  locales too.
- `public/robots.txt` (everything open but `/api/` and `/stats`),
  `public/sitemap.xml` and `public/llms.txt` (a plain summary of the site and
  its link format for AI assistants).
- Icons: `public/favicon.svg` (the TT monogram on a globe) and
  `favicon.ico` (16, 32, 48 px) for browser tabs; `apple-touch-icon.png`
  (180 px) and `icons/icon-192.png`, `icons/icon-512.png` (the TT monogram on
  the globe from the launch pictures) for phones and `site.webmanifest`.
- Link previews: `public/social/og-en.jpg`, `og-fr.jpg`, `og-es.jpg`
  (1200 × 630). They quote the counts of civilizations and turning points, so
  remake them if those change a lot.

After publishing, a few things are done outside the repository:

1. In Cloudflare, Security → Bots (or AI Crawl Control): leave "Block AI
   bots" off and don't turn on Cloudflare's managed `robots.txt`, or AI
   assistants won't be able to read the site.
2. Add the site to [Google Search Console](https://search.google.com/search-console)
   and [Bing Webmaster Tools](https://www.bing.com/webmasters) (Bing also
   feeds ChatGPT search and DuckDuckGo), and submit
   `https://terra-tempora.com/sitemap.xml` in both.
3. Check the previews with the [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)
   and Mastodon (paste the link in a draft post).

## Feedback

Visitors can report an error, missing data or an idea from the "Report a
problem" links (on a realm, an event, a turning point, the sources panel and
the Civilizations popup) or by right-clicking any spot on the globe or map. Each
report becomes a GitHub issue labelled `feedback` plus its type, with the
year, place, language and a link back to what the visitor was looking at.
For a report made by right-clicking a spot, the link carries that spot
(`&p=<lon>,<lat>`) and its year, and opening it pins the spot on the globe
or map.

`worker/index.js` receives the reports at `/api/feedback` and files them; it
limits each visitor to 5 reports a minute and ignores bots that fill a hidden
field. To turn it on, set its secrets with Wrangler from the project folder
(the dashboard may refuse, saying the Worker only has static assets):

1. `npx wrangler login`, then `npx wrangler secret put GITHUB_TOKEN` and paste
   a fine-grained GitHub token for this repository only, with "Issues: Read
   and write" permission. Deploys keep it; don't add it as a plain variable,
   which every deploy would wipe.
2. Optionally, against spam: create a Turnstile widget (Cloudflare →
   Turnstile) for the site's domain, `npx wrangler secret put TURNSTILE_SECRET`
   with its secret key, and add its site key as the build variable
   `VITE_TURNSTILE_SITE_KEY` (Settings → Build → Variables), then redeploy.

Branch previews don't get these secrets. Previews created after you set one
under Variables and Secrets → Previews Base get it; for an existing preview,
run `npx wrangler preview secret put GITHUB_TOKEN --name <branch>`.

### Visitors' emails

The form has an optional email field, so the visitor can hear about the fix,
and a box "I want to help fix the issue I reported". The page encrypts the
email with a public key before sending (RSA-OAEP with SHA-256, 4096-bit), so
only sealed text reaches the Worker and the GitHub issue, where robots
scanning for addresses find nothing. The issue's table gets an "Issuer offered
to help" row (Yes or No) and, when an email was given, an "Issuer email" row
holding the sealed email, starting `tt1:`. The email field stays hidden until
a key is set up:

1. On your own computer, run `npm run contact-key`. It asks for a passphrase,
   writes the private key to `.keys/contact-private.pem` (ignored by git; the
   script refuses to write it anywhere git would commit) and the public key to
   `src/contactKey.ts`. Commit that file and deploy. Keep a copy of the
   private key and its passphrase somewhere safe, such as a password
   manager: without them, sealed emails can't be read.
2. To read an email, run `npm run read-contact`, paste the `tt1:…` text (or
   the whole issue) and press Enter on an empty line; it prints the email.
   Nothing is sent anywhere. Set `CONTACT_PRIVATE_KEY` to read the key from
   another path.

A new key (`npm run contact-key -- --replace`) only opens emails sealed after
it is deployed; keep the old file to read older ones.

Until `GITHUB_TOKEN` is set, sending a report shows an error. To try it
locally, run `npm run build` then `npx wrangler dev --var GITHUB_TOKEN:<token>`.

## Support

The Support button in the toolbar (in the menu on phones) opens a pop-up with
three choices: a tip on [Ko-fi](https://ko-fi.com/edgarmaucourant), a
sponsorship on [GitHub Sponsors](https://github.com/sponsors/EdgarMaucourant),
or a kind word for the author. The first two are plain links, so nothing loads
from those sites and the Content Security Policy needs no change.
`.github/FUNDING.yml` shows the same two on the repository's Sponsor button.

A kind word goes to `/api/message`, and the Worker emails it privately to the
author through Cloudflare Email Routing (the `MESSAGES` send_email binding in
`wrangler.jsonc`). It is never published. A visitor who gives their email
(optional) becomes the email's Reply-To, so Reply answers them. It has the same limit per address and
the same Turnstile check as reports. To turn it on:

1. Email Routing must be on for the site's domain (Cloudflare → the domain →
   Email → Email Routing), with the receiving address listed and verified under
   Destination addresses.
2. `npx wrangler secret put MESSAGE_TO` with that address. It is a secret so
   the address stays out of this public repository. For branch previews, add
   it under Variables and Secrets → Previews Base too.

The sender is `MESSAGE_FROM` in `wrangler.jsonc`, an address on the domain; it
needs no mailbox.

## Usage counts

The site counts, anonymously, what visitors do, and shows it on a private
page at `/stats`:

- the controls they press (play, speed, globe or map, projection, axis, menu,
  about, language…) and the choices they make in them;
- the lists they open, and the civilizations, countries and nations they
  open, from a card, a link, the globe or the timeline;
- the realms and events they click, and the links they follow out;
- the history travel: how far each playthrough gets (a curve of the share
  that reached each turning point), why time was stopped, and the turning
  point cards opened;
- the time the timeline spends on each century while the page is seen and in
  use, or the travel plays;
- searches in the lists that found nothing, to show what is missing;
- per visit: where it came from (`?ref=` or `?utm_source=` in the link, else
  the referring site), the country, the language and the kind of device.

Nothing identifies a visitor: no cookie, nothing kept in the browser, no
visitor id and no IP address, so no consent banner is needed. Browsers that
send Do Not Track or Global Privacy Control send nothing. `src/analytics.ts`
collects the events and sends them in batches to `POST /api/track`, where
`worker/index.js` writes them to Cloudflare Analytics Engine (three months
kept). Branch previews count nothing.

To share a link that shows up as its own source, add `?ref=`, for example
`https://<site>/?ref=reddit`; the page drops it from the address once read.

Counting needs Analytics Engine turned on for the Cloudflare account, once:
Storage & databases → Analytics Engine → create the dataset
`terra_tempora_events` with the binding `EVENTS` (until then, deploys fail
saying Analytics Engine is not enabled). To read the counts at `/stats`:

1. Cloudflare One (formerly Zero Trust) → Access controls → Applications →
   Add an application → Self-hosted. Add the site's domain twice, with the
   paths `stats` and `api/stats`, and a policy that allows only your
   email. Copy the application's audience (AUD) tag (its Additional
   settings tab; not the policy id).
   Your team domain (e.g. `yourteam.cloudflareaccess.com`) and account id
   are under Account details on the Cloudflare One overview.
2. Create an API token (My Profile → API Tokens → Create Token → Custom)
   with the permission Account → Account Analytics → Read.
3. From the project folder, set the Worker's secrets:
   `npx wrangler secret put STATS_ACCOUNT_ID` (the account id),
   `npx wrangler secret put STATS_API_TOKEN`,
   `npx wrangler secret put ACCESS_TEAM` (the team domain) and
   `npx wrangler secret put ACCESS_AUD` (the AUD tag).

`/api/stats` checks the Access sign-in itself, so the counts stay private
even if the Access rule were removed; until it is all set up, `/stats` names
the missing settings.

