import { execFileSync } from "node:child_process";
import { cpSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const cesiumSource = "node_modules/cesium/Build/Cesium";
// Only the Cesium runtime files the globe needs: web workers, the Natural Earth
// imagery shipped with Cesium, the star field and a terrain height table.
const cesiumAssets = [
  "Workers",
  "Assets/Textures/NaturalEarthII",
  "Assets/Textures/SkyBox",
  "Assets/Images",
  "Assets/approximateTerrainHeights.json",
];

function copyCesiumAssets(): Plugin {
  let outDir = "dist";
  return {
    name: "copy-cesium-assets",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    // In development the files are served straight from node_modules (see `server` below).
    closeBundle() {
      for (const path of cesiumAssets) {
        cpSync(`${cesiumSource}/${path}`, `${outDir}/cesium/${path}`, { recursive: true });
      }
    },
  };
}

// The commit being built, sent with visitors' reports: Cloudflare's build gives
// it; elsewhere git does.
function version(): string {
  if (process.env.WORKERS_CI_COMMIT_SHA) return process.env.WORKERS_CI_COMMIT_SHA.slice(0, 7);
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"]).toString().trim();
  } catch {
    return "dev";
  }
}

export default defineConfig(({ command }) => ({
  base: "./",
  define: {
    CESIUM_BASE_URL: JSON.stringify(command === "serve" ? `/${cesiumSource}` : "./cesium"),
    __APP_VERSION__: JSON.stringify(version()),
  },
  build: {
    chunkSizeWarningLimit: 6000,
    // The globe, and the maintainers' /stats page.
    rollupOptions: { input: { main: "index.html", stats: "stats.html" } },
  },
  plugins: [copyCesiumAssets()],
}));
