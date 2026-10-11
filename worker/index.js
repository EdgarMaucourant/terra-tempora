// The Cloudflare Worker in front of the static site. It answers /api/*
// itself; every other path is served straight from the built files in dist/
// (see `run_worker_first` in wrangler.jsonc).
//
// POST /api/feedback files a visitor's report as a GitHub issue, with what
// they were looking at, so reviewers can triage it where they already work.
//
// Settings (Cloudflare → Workers → terra-tempora → Settings → Variables and Secrets):
//   GITHUB_TOKEN      secret: a fine-grained token allowed to write issues on GITHUB_REPO
//   GITHUB_REPO       e.g. "EdgarMaucourant/terra-tempora" (set in wrangler.jsonc)
//   TURNSTILE_SECRET  optional secret: when set, every report must pass Cloudflare Turnstile

const TYPES = {
  error: { label: "feedback: error", title: "Error" },
  missing: { label: "feedback: missing data", title: "Missing" },
  idea: { label: "feedback: improvement", title: "Idea" },
};
const MIN_MESSAGE = 10;
const MAX_MESSAGE = 3000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/feedback") {
      if (request.method !== "POST") return json({ error: "method" }, 405, { Allow: "POST" });
      return feedback(request, env);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "not-found" }, 404);
    return env.ASSETS.fetch(request);
  },
};

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });
}

/** A short single line of visitor text: no line breaks, at most `max` characters. */
function line(value, max = 200) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Visitor text made safe to quote in an issue: no @mentions and no stray markup. */
function quote(text) {
  return text
    .replace(/@/g, "@\u200b")
    .replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;"))
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
}

async function feedback(request, env) {
  // Names the missing settings (never their values) so a misconfigured deploy is easy to spot.
  const missing = ["GITHUB_TOKEN", "GITHUB_REPO"].filter((name) => !env[name]);
  if (missing.length) return json({ error: "not-configured", missing }, 503);
  // Reports come from our own pages only.
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "origin" }, 403);

  const ip = request.headers.get("CF-Connecting-IP");
  if (env.FEEDBACK_LIMIT && ip) {
    const { success } = await env.FEEDBACK_LIMIT.limit({ key: ip });
    if (!success) return json({ error: "too-many" }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad-request" }, 400);
  }
  // A field people never see: bots fill it in, people leave it empty.
  if (body.website) return json({ ok: true });
  const type = TYPES[body.type] ? body.type : null;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!type || message.length < MIN_MESSAGE || message.length > MAX_MESSAGE) return json({ error: "invalid" }, 400);

  if (env.TURNSTILE_SECRET) {
    const form = new FormData();
    form.append("secret", env.TURNSTILE_SECRET);
    form.append("response", line(body.turnstile, 2048));
    if (ip) form.append("remoteip", ip);
    const check = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form })
      .then((r) => r.json())
      .catch(() => ({ success: false }));
    if (!check.success) return json({ error: "turnstile" }, 403);
  }

  const c = body.context && typeof body.context === "object" ? body.context : {};
  const subject = line(c.name, 80) || "the app";
  const view = line(c.url, 500);
  const sameSite = view.startsWith(new URL(request.url).origin);
  const rows = [
    ["Type", TYPES[type].title],
    ["About", [line(c.kind, 40), line(c.id, 120)].filter(Boolean).join(" ") || "the app"],
    ["Year", Number.isFinite(c.year) ? String(Math.round(c.year)) : ""],
    ["Place", Array.isArray(c.lonLat) && c.lonLat.every(Number.isFinite) ? c.lonLat.map((n) => n.toFixed(2)).join(", ") : ""],
    ["View", sameSite ? `[open what they saw](${view})` : ""],
    ["Language", line(c.lang, 10)],
    ["Screen", line(c.screen, 20)],
    ["Version", line(c.version, 40)],
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
  return json({ ok: true }, 201);
}
