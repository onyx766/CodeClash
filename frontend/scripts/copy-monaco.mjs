// Copies the Monaco editor's browser build (node_modules/monaco-editor/min/vs)
// to public/monaco/vs. The battle page loads the editor from there (see
// lib/monaco.ts) instead of @monaco-editor/loader's default, cdn.jsdelivr.net,
// so it also works on offline and LAN installs and no player's IP address is
// sent to a third party. Runs before `next dev` and `next build` (the predev
// and prebuild scripts), so every build - the Docker image's included - makes
// its own copy. public/monaco is generated: it is not committed.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Copies `<packageDir>/min/vs` to `<targetDir>/vs` and records the version in
 * `<targetDir>/VERSION`. Skips the copy when targetDir already holds that
 * version, so starting the dev server stays fast.
 */
export function copyMonaco({ packageDir, targetDir }) {
  const { version } = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
  const marker = join(targetDir, "VERSION");
  const copiedVersion = existsSync(marker) ? readFileSync(marker, "utf8").trim() : null;
  if (copiedVersion === version && existsSync(join(targetDir, "vs", "loader.js"))) {
    return { version, copied: false };
  }
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
  cpSync(join(packageDir, "min", "vs"), join(targetDir, "vs"), { recursive: true });
  writeFileSync(marker, `${version}\n`);
  return { version, copied: true };
}

/** The monaco-editor version a @monaco-editor/loader build was made for, read from its CDN default. */
export function loaderMonacoVersion(loaderConfigSource) {
  return /monaco-editor@([^/'"\s]+)\/min\/vs/.exec(loaderConfigSource)?.[1] ?? null;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const require = createRequire(import.meta.url);
  const packageDir = dirname(require.resolve("monaco-editor/package.json"));
  const { version, copied } = copyMonaco({ packageDir, targetDir: join(root, "public", "monaco") });
  console.log(
    copied
      ? `Copied monaco-editor ${version} to public/monaco/vs.`
      : `public/monaco/vs already holds monaco-editor ${version}.`,
  );

  // The editor API the loader calls must match the files served here.
  try {
    const loaderEntry = require.resolve("@monaco-editor/loader");
    const expected = loaderMonacoVersion(readFileSync(join(dirname(loaderEntry), "config", "index.js"), "utf8"));
    if (expected && expected !== version) {
      console.warn(
        `Warning: @monaco-editor/loader expects monaco-editor ${expected}, but ${version} is installed. ` +
          `Pin "monaco-editor": "${expected}" in package.json.`,
      );
    }
  } catch {
    // Only a consistency check: the copy itself succeeded.
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
