// The Cloudflare Worker in front of the static site. It answers /api/*
// itself; every other path is served straight from the built files in dist/
// (see `run_worker_first` in wrangler.jsonc), and a path that matches no file
// gets the site's 404 page.
//
// POST /api/feedback files a visitor's report as a GitHub issue, with what
// they were looking at, so reviewers can triage it where they already work.
// A visitor who offers to help sends their email already encrypted by the
// page (src/feedback.ts); it is filed as that sealed text, which only the
// maintainers' private key opens (`npm run read-contact`).
//
// POST /api/message emails a visitor's kind word (from the Support pop-up,
// src/support.ts) privately to the author, through Cloudflare Email Routing.
// It is never published, and nothing about the visitor is sent with it but
// the name and email they chose to give and the site's language. Their email
// becomes the Reply-To, so the author can answer with the Reply button.
//
// GET /api/where gives the visitor's rough whereabouts as Cloudflare reads
// them from their connection (country and the city's coordinates), so the
// globe can turn to their part of the world without asking for their
// location. Nothing is stored.
//
// POST /api/track takes the page's anonymous usage counts (src/analytics.ts)
// and writes them to Cloudflare Analytics Engine: no cookie, no visitor id and
// no IP address; the country comes from Cloudflare's reading of the
// connection. GET /api/stats reads them back for the private /stats page, and
// only for someone signed in through Cloudflare Access.
//
// Settings (Cloudflare → Workers → terra-tempora → Settings → Variables and Secrets):
//   GITHUB_TOKEN      secret: a fine-grained token allowed to write issues on GITHUB_REPO
//   GITHUB_REPO       e.g. "EdgarMaucourant/terra-tempora" (set in wrangler.jsonc)
//   MESSAGE_TO        secret: the address kind words go to; it must be a verified
//                     destination address under Email Routing on the site's domain
//   MESSAGE_FROM      the sender of those emails, an address on that domain (set in wrangler.jsonc)
//   TURNSTILE_SECRET  optional secret: when set, every report must pass Cloudflare Turnstile
//   STATS_DATASET     the Analytics Engine dataset /api/stats reads (set in wrangler.jsonc)
//   STATS_ACCOUNT_ID  secret: the Cloudflare account id, for the Analytics Engine SQL API
//   STATS_API_TOKEN   secret: a token with "Account Analytics: Read" on that account
//   ACCESS_TEAM       the Cloudflare Access team domain, e.g. "terra-tempora.cloudflareaccess.com"
//   ACCESS_AUD        the Access application's audience tag; /api/stats answers only to its signed-in users

import { EmailMessage } from "cloudflare:email";

const TYPES = {
  error: { label: "feedback: error", title: "Error" },
  missing: { label: "feedback: missing data", title: "Missing" },
  idea: { label: "feedback: improvement", title: "Idea" },
};
const MIN_MESSAGE = 10;
const MAX_MESSAGE = 3000;
// A report is a few kilobytes at most; anything much larger is refused unread.
const MAX_BODY = 16_384;
// An email sealed by the page: "tt1:<key id>:<base64 of 512 bytes>".
const SEALED_CONTACT = /^tt1:[0-9a-f]{12}:[A-Za-z0-9+/]{680,690}={0,2}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/feedback") {
      if (request.method !== "POST") return json({ error: "method" }, 405, { Allow: "POST" });
      return feedback(request, env);
    }
    if (url.pathname === "/api/message") {
      if (request.method !== "POST") return json({ error: "method" }, 405, { Allow: "POST" });
      return kindWord(request, env);
    }
    if (url.pathname === "/api/where") return where(request);
    if (url.pathname === "/api/track") {
      if (request.method !== "POST") return json({ error: "method" }, 405, { Allow: "POST" });
      return trackEvents(request, env);
    }
    if (url.pathname === "/api/stats") return stats(request, env, url);
    if (url.pathname.startsWith("/api/")) return json({ error: "not-found" }, 404);
    return env.ASSETS.fetch(request);
  },
};

function where(request) {
  const cf = request.cf ?? {};
  const lat = Number(cf.latitude);
  const lon = Number(cf.longitude);
  return json({
    country: typeof cf.country === "string" ? cf.country : null,
    lonLat: Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : null,
  });
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

/** A short single line of visitor text: no line breaks, at most `max` characters. */
function line(value, max = 200) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Visitor text made safe to quote in an issue: no @mentions, no markup and no disguised links. */
function quote(text) {
  return text
    .replace(/@/g, "@\u200b")
    .replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"))
    .replace(/[[\]]/g, "\\$&")
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
}

/** A short line of visitor text for the issue's table, as code: GitHub shows it as typed, with no mentions or markup. */
function code(value, max) {
  const text = line(value, max).replace(/`/g, "'");
  return text ? `\`${text}\`` : "";
}

/** The link back to what the visitor saw, when it is a page of this site. */
function viewLink(value, origin) {
  try {
    const url = new URL(line(value, 500));
    if (url.origin !== origin) return "";
    // Brackets would end the Markdown link early.
    return `[open what they saw](${url.href.replace(/[()]/g, (c) => (c === "(" ? "%28" : "%29"))})`;
  } catch {
    return "";
  }
}

/**
 * Reports and kind words come from our own pages only, and at most 5 a
 * minute from one address. Returns the refusal, or null.
 */
async function visitorCheck(request, env) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "origin" }, 403);
  const ip = request.headers.get("CF-Connecting-IP");
  if (env.FEEDBACK_LIMIT && ip) {
    const { success } = await env.FEEDBACK_LIMIT.limit({ key: ip });
    if (!success) return json({ error: "too-many" }, 429);
  }
  return null;
}

/** The request's JSON object, or the refusal when it is too large or not an object. */
async function readJson(request) {
  if (Number(request.headers.get("Content-Length")) > MAX_BODY) return json({ error: "too-large" }, 413);
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: "too-large" }, 413);
    const body = JSON.parse(text);
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {
    // Falls through to the refusal below.
  }
  return json({ error: "bad-request" }, 400);
}

/** Cloudflare Turnstile's verdict on the page's token, when TURNSTILE_SECRET is set: the refusal, or null. */
async function turnstileCheck(request, env, body) {
  if (!env.TURNSTILE_SECRET) return null;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", line(body.turnstile, 2048));
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) form.append("remoteip", ip);
  const check = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form })
    .then((r) => r.json())
    .catch(() => ({ success: false }));
  return check.success ? null : json({ error: "turnstile" }, 403);
}

async function feedback(request, env) {
  // Names the missing settings (never their values) so a misconfigured deploy is easy to spot.
  const missing = ["GITHUB_TOKEN", "GITHUB_REPO"].filter((name) => !env[name]);
  if (missing.length) return json({ error: "not-configured", missing }, 503);
  const refused = await visitorCheck(request, env);
  if (refused) return refused;
  const body = await readJson(request);
  if (body instanceof Response) return body;
  // A field people never see: bots fill it in, people leave it empty.
  if (body.website) return json({ ok: true });
  const type = Object.hasOwn(TYPES, body.type) ? body.type : null;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!type || message.length < MIN_MESSAGE || message.length > MAX_MESSAGE) return json({ error: "invalid" }, 400);
  const contact = typeof body.contact === "string" ? body.contact : "";
  if (contact && !SEALED_CONTACT.test(contact)) return json({ error: "invalid" }, 400);

  const turnstile = await turnstileCheck(request, env, body);
  if (turnstile) return turnstile;

  const c = body.context && typeof body.context === "object" ? body.context : {};
  const subject = line(c.name, 80) || "the app";
  const rows = [
    ["Type", TYPES[type].title],
    ["About", code([line(c.kind, 40), line(c.id, 120)].filter(Boolean).join(" "), 170) || "the app"],
    ["Year", Number.isFinite(c.year) ? String(Math.round(c.year)) : ""],
    [
      "Place",
      Array.isArray(c.lonLat) && c.lonLat.length === 2 && c.lonLat.every(Number.isFinite)
        ? c.lonLat.map((n) => n.toFixed(2)).join(", ")
        : "",
    ],
    ["View", viewLink(c.url, new URL(request.url).origin)],
    ["Language", code(c.lang, 10)],
    ["Screen", code(c.screen, 20)],
    ["Version", code(c.version, 40)],
    // Sealed text only: `npm run read-contact` turns it back into their email.
    ["Issuer offered to help", contact ? `\`${contact}\`` : ""],
  ].filter(([, v]) => v);
  const issue = {
    title: `${TYPES[type].title}: ${subject} · ${line(message, 60)}`.replace(/@/g, "@\u200b"),
    body: [
      quote(message),
      "",
      "| | |",
      "| --- | --- |",
      ...rows.map(([k, v]) => `| ${k} | ${v.replace(/\|/g, "\\|")} |`),
      "",
      "_Sent from the Report link in Terra Tempora._",
    ].join("\n"),
    labels: ["feedback", TYPES[type].label],
  };

  const api = env.GITHUB_API || "https://api.github.com";
  const response = await fetch(`${api}/repos/${env.GITHUB_REPO}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "terra-tempora-feedback",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(issue),
  });
  if (!response.ok) {
    console.error("GitHub refused the issue", response.status, await response.text());
    return json({ error: "github" }, 502);
  }
  // The issue's page, so the page can show the visitor where to follow their report.
  const created = await response.json().catch(() => ({}));
  const url = typeof created.html_url === "string" && created.html_url.startsWith("https://github.com/") ? created.html_url : undefined;
  return json({ ok: true, url, number: Number.isInteger(created.number) ? created.number : undefined }, 201);
}

// Kind words

const MAX_KIND_WORD = 2000;
// A plain address, with nothing that could end a mail header early.
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

async function kindWord(request, env) {
  const missing = ["MESSAGES", "MESSAGE_TO", "MESSAGE_FROM"].filter((name) => !env[name]);
  if (missing.length) return json({ error: "not-configured", missing }, 503);
  const refused = await visitorCheck(request, env);
  if (refused) return refused;
  const body = await readJson(request);
  if (body instanceof Response) return body;
  if (body.website) return json({ ok: true });
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < MIN_MESSAGE || message.length > MAX_KIND_WORD) return json({ error: "invalid" }, 400);
  const turnstile = await turnstileCheck(request, env, body);
  if (turnstile) return turnstile;

  const name = line(body.name, 60);
  const replyTo = typeof body.email === "string" ? body.email.trim() : "";
  if (replyTo && (replyTo.length > 254 || !EMAIL.test(replyTo))) return json({ error: "invalid" }, 400);
  const lang = line(body.lang, 10);
  const text = [
    message,
    "",
    "--",
    name ? `From: ${name}` : "From: (no name given)",
    replyTo ? `Email: ${replyTo} (press Reply to answer)` : "Email: none given, so there is no one to reply to",
    `Site language: ${lang || "unknown"}`,
    "Sent from the Support pop-up of Terra Tempora.",
  ].join("\n");
  const subject = `A kind word${name ? ` from ${name}` : ""}: ${line(message, 50)}`;
  try {
    await env.MESSAGES.send(new EmailMessage(env.MESSAGE_FROM, env.MESSAGE_TO, mime(env.MESSAGE_FROM, env.MESSAGE_TO, subject, text, replyTo)));
  } catch (error) {
    console.error("The kind word could not be emailed", String(error));
    return json({ error: "email" }, 502);
  }
  return json({ ok: true }, 201);
}

/** A plain-text email, as Cloudflare's send_email binding takes it. */
function mime(from, to, subject, text, replyTo) {
  const domain = from.split("@")[1] ?? "terra-tempora.com";
  const words = (value) => `=?UTF-8?B?${base64(value)}?=`;
  const body = base64(text.replace(/\r?\n/g, "\r\n")).replace(/.{76}/g, "$&\r\n");
  return [
    `From: ${words("Terra Tempora")} <${from}>`,
    `To: <${to}>`,
    ...(replyTo ? [`Reply-To: <${replyTo}>`] : []),
    `Subject: ${words(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ].join("\r\n");
}

function base64(text) {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// Usage counts

// The events the page sends (src/analytics.ts); anything else is dropped.
const EVENTS = new Set([
  "visit",
  "feature",
  "list",
  "open",
  "realm",
  "event",
  "search",
  "link",
  "period",
  "travel",
  "travel-pause",
  "travel-card",
]);
// A batch holds 25 events, plus the time spent on up to 40 centuries.
const MAX_TRACKED = 80;
const MAX_TRACK_BODY = 32_768;
const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|preview/i;

/** A finite number, rounded and kept within ±limit, else 0. */
function number(value, limit = 1e6) {
  return Number.isFinite(value) ? Math.max(-limit, Math.min(limit, Math.round(value))) : 0;
}

async function trackEvents(request, env) {
  // Answered the same whatever happens: the page never waits on it or retries.
  const done = new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  if (!env.EVENTS) return done;
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return done;
  if (BOTS.test(request.headers.get("User-Agent") ?? "")) return done;
  const ip = request.headers.get("CF-Connecting-IP");
  if (env.TRACK_LIMIT && ip) {
    const { success } = await env.TRACK_LIMIT.limit({ key: ip });
    if (!success) return done;
  }
  if (Number(request.headers.get("Content-Length")) > MAX_TRACK_BODY) return done;
  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_TRACK_BODY) return done;
    body = JSON.parse(text);
  } catch {
    return done;
  }
  if (!body || typeof body !== "object" || !Array.isArray(body.events)) return done;
  const country = typeof request.cf?.country === "string" ? request.cf.country : "";
  const lang = line(body.lang, 10);
  const device = ["phone", "tablet", "desktop"].includes(body.device) ? body.device : "";
  const source = line(body.source, 40).toLowerCase();
  const version = line(body.version, 12);
  for (const e of body.events.slice(0, MAX_TRACKED)) {
    if (!e || typeof e !== "object" || !EVENTS.has(e.name)) continue;
    env.EVENTS.writeDataPoint({
      indexes: [e.name],
      // Their order is the dataset's columns, blob1 to blob11: see STATS_QUERIES.
      blobs: [
        e.name,
        line(e.subject, 80),
        line(e.detail, 80),
        line(e.via, 10),
        line(e.session, 12),
        lang,
        device,
        country,
        source,
        e.view === "map" ? "map" : "globe",
        version,
      ],
      // double1 the year, double2 seconds, double3 a count.
      doubles: [number(e.year, 20_000), number(e.value, 86_400), number(e.count, 100_000)],
    });
  }
  return done;
}

// What the /stats page shows, one SQL query each. Analytics Engine keeps a
// sample of the events when there are many, so each row counts as
// _sample_interval events.
const STATS_QUERIES = {
  visits: `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, SUM(_sample_interval) AS n
    FROM {ds} WHERE blob1 = 'visit' AND {since} GROUP BY day ORDER BY day`,
  arrivals: `SELECT blob2 AS kind, SUM(_sample_interval) AS n FROM {ds} WHERE blob1 = 'visit' AND {since} GROUP BY kind ORDER BY n DESC`,
  features: `SELECT blob2 AS name, SUM(_sample_interval) AS n FROM {ds} WHERE blob1 = 'feature' AND {since}
    GROUP BY name ORDER BY n DESC LIMIT 40`,
  choices: `SELECT blob2 AS name, blob3 AS value, SUM(_sample_interval) AS n FROM {ds} WHERE blob1 = 'feature' AND blob3 != '' AND {since}
    GROUP BY name, value ORDER BY n DESC LIMIT 40`,
  lists: `SELECT blob2 AS name, SUM(_sample_interval) AS n FROM {ds} WHERE blob1 = 'list' AND {since} GROUP BY name ORDER BY n DESC`,
  views: `SELECT blob10 AS name, SUM(_sample_interval) AS n FROM {ds} WHERE blob1 != 'period' AND {since} GROUP BY name ORDER BY n DESC`,
  opened: `SELECT blob3 AS kind, blob2 AS id, SUM(_sample_interval) AS n FROM {ds} WHERE blob1 = 'open' AND {since}
    GROUP BY kind, id ORDER BY n DESC LIMIT 150`,
  realms: `SELECT blob2 AS name, SUM(_sample_interval) AS n FROM {ds} WHERE blob1 = 'realm' AND {since}
    GROUP BY name ORDER BY n DESC LIMIT 30`,
  events: `SELECT blob1 AS kind, blob2 AS id, SUM(_sample_interval) AS n FROM {ds} WHERE (blob1 = 'event' OR blob1 = 'travel-card') AND {since}
    GROUP BY kind, id ORDER BY n DESC LIMIT 60`,
  periods: `SELECT blob2 AS mode, double1 AS century, SUM(_sample_interval * double2) AS seconds FROM {ds}
    WHERE blob1 = 'period' AND {since} GROUP BY mode, century ORDER BY century`,
  travel: `SELECT blob5 AS session, MAX(double3) AS reached, MAX(double2) AS seconds, MAX(_sample_interval) AS weight FROM {ds}
    WHERE blob1 = 'travel' AND blob2 = 'end' AND {since} GROUP BY session LIMIT 20000`,
  travelStarts: `SELECT SUM(_sample_interval) AS n FROM {ds} WHERE blob1 = 'travel' AND blob2 = 'start' AND {since}`,
  pauses: `SELECT blob3 AS reason, SUM(_sample_interval) AS n FROM {ds} WHERE blob1 = 'travel-pause' AND {since}
    GROUP BY reason ORDER BY n DESC`,
  searches: `SELECT blob2 AS section, blob3 AS query, SUM(_sample_interval) AS n FROM {ds}
    WHERE blob1 = 'search' AND double3 = 0 AND {since} GROUP BY section, query ORDER BY n DESC LIMIT 40`,
  links: `SELECT blob2 AS name, SUM(_sample_interval) AS n FROM {ds} WHERE blob1 = 'link' AND {since} GROUP BY name ORDER BY n DESC LIMIT 20`,
  sources: `SELECT blob9 AS name, SUM(_sample_interval) AS n FROM {ds} WHERE blob1 = 'visit' AND {since} GROUP BY name ORDER BY n DESC LIMIT 25`,
  countries: `SELECT blob8 AS name, SUM(_sample_interval) AS n FROM {ds} WHERE blob1 = 'visit' AND {since} GROUP BY name ORDER BY n DESC LIMIT 25`,
  languages: `SELECT blob6 AS name, SUM(_sample_interval) AS n FROM {ds} WHERE blob1 = 'visit' AND {since} GROUP BY name ORDER BY n DESC`,
  devices: `SELECT blob7 AS name, SUM(_sample_interval) AS n FROM {ds} WHERE blob1 = 'visit' AND {since} GROUP BY name ORDER BY n DESC`,
};

const NUMERIC = new Set(["n", "century", "seconds", "reached", "weight"]);

async function stats(request, env, url) {
  if (request.method !== "GET") return json({ error: "method" }, 405, { Allow: "GET" });
  const missing = ["STATS_DATASET", "STATS_ACCOUNT_ID", "STATS_API_TOKEN", "ACCESS_TEAM", "ACCESS_AUD"].filter((name) => !env[name]);
  if (missing.length) return json({ error: "not-configured", missing }, 503);
  const problem = await accessProblem(request, env);
  if (problem) return json({ error: "sign-in", problem }, 401);
  if (!/^[A-Za-z0-9_]+$/.test(env.STATS_DATASET)) return json({ error: "not-configured", missing: ["STATS_DATASET"] }, 503);
  // Analytics Engine keeps three months.
  const days = Math.max(1, Math.min(90, Math.round(Number(url.searchParams.get("days")) || 30)));
  const since = `timestamp > NOW() - INTERVAL '${days}' DAY`;
  const api = `https://api.cloudflare.com/client/v4/accounts/${env.STATS_ACCOUNT_ID}/analytics_engine/sql`;
  const entries = await Promise.all(
    Object.entries(STATS_QUERIES).map(async ([name, sql]) => {
      const query = `${sql.replaceAll("{ds}", env.STATS_DATASET).replaceAll("{since}", since)} FORMAT JSON`;
      const response = await fetch(api, { method: "POST", headers: { Authorization: `Bearer ${env.STATS_API_TOKEN}` }, body: query });
      if (!response.ok) {
        console.error("Analytics Engine refused a query", name, response.status, await response.text());
        return [name, null];
      }
      const { data } = await response.json();
      // Counts come back as text when they are 64-bit.
      const rows = data.map((row) =>
        Object.fromEntries(Object.entries(row).map(([k, v]) => [k, NUMERIC.has(k) ? Number(v) : v])),
      );
      return [name, rows];
    }),
  );
  return json({ days, ...Object.fromEntries(entries) });
}

// Cloudflare Access signs in whoever opens /stats and hands each request a
// signed token: in the Cf-Access-Jwt-Assertion header where an Access rule
// covers the path, and in the CF_Authorization cookie for the rest of the
// site. The token is checked here too, so the counts stay private even if
// the Access rule were ever removed. Returns why the sign-in was refused
// (shown on /stats to help with the setup), or null when it is valid.
async function accessProblem(request, env) {
  const cookie = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(request.headers.get("Cookie") ?? "");
  const token = request.headers.get("Cf-Access-Jwt-Assertion") ?? cookie?.[1];
  const parts = token?.split(".");
  if (parts?.length !== 3) return "no-token";
  try {
    const [head, claims, signature] = parts;
    const header = JSON.parse(base64UrlText(head));
    const payload = JSON.parse(base64UrlText(claims));
    const team = `https://${env.ACCESS_TEAM.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (header.alg !== "RS256") return "algorithm";
    if (payload.iss !== team) return "team";
    if (!audiences.includes(env.ACCESS_AUD.trim())) return "audience";
    if (!(payload.exp > Date.now() / 1000)) return "expired";
    const certs = await fetch(`${team}/cdn-cgi/access/certs`, { cf: { cacheTtl: 3600 } }).then((r) => r.json());
    const jwk = certs.keys?.find((k) => k.kid === header.kid);
    if (!jwk) return "key";
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64UrlBytes(signature), new TextEncoder().encode(`${head}.${claims}`));
    return valid ? null : "signature";
  } catch {
    return "unreadable";
  }
}

function base64UrlBytes(text) {
  const plain = atob(text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "="));
  return Uint8Array.from(plain, (c) => c.charCodeAt(0));
}

function base64UrlText(text) {
  return new TextDecoder().decode(base64UrlBytes(text));
}
