// Turns dist/index.html into a page body for a claude.ai Artifact preview,
// which supplies its own <html>, <head> and <body>, and lists the files to publish.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const dist = "dist";
const html = readFileSync(join(dist, "index.html"), "utf8");
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keep = head
  .split("\n")
  .filter((line) => !/<meta /.test(line))
  .join("\n");
const moduleScripts = keep.match(/<script type="module"[\s\S]*?<\/script>/g) ?? [];
const headWithoutScripts = keep.replace(/<script type="module"[\s\S]*?<\/script>/g, "");
writeFileSync(join(dist, "artifact.html"), `${headWithoutScripts.trim()}\n${body.trim()}\n${moduleScripts.join("\n")}\n`);

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(relative(dist, path));
  }
};
walk(dist);
const published = files.filter((f) => f !== "index.html" && f !== "artifact.html");
writeFileSync(join(dist, "artifact-files.json"), JSON.stringify(published));
console.log(`${published.length} files besides the page`);
