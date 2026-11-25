import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyMonaco, loaderMonacoVersion } from "./copy-monaco.mjs";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "copy-monaco-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** A stand-in for node_modules/monaco-editor with the given files under min/vs. */
function fakePackage(version: string, files: Record<string, string>) {
  const packageDir = join(dir, `monaco-editor-${version}`);
  for (const [path, content] of Object.entries(files)) {
    const file = join(packageDir, "min", "vs", path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name: "monaco-editor", version }));
  return packageDir;
}

describe("copyMonaco", () => {
  it("copies min/vs and records the version", () => {
    const packageDir = fakePackage("0.55.1", { "loader.js": "loader", "editor/editor.main.js": "main" });
    const targetDir = join(dir, "public", "monaco");

    expect(copyMonaco({ packageDir, targetDir })).toEqual({ version: "0.55.1", copied: true });
    expect(readFileSync(join(targetDir, "vs", "loader.js"), "utf8")).toBe("loader");
    expect(readFileSync(join(targetDir, "vs", "editor", "editor.main.js"), "utf8")).toBe("main");
    expect(readFileSync(join(targetDir, "VERSION"), "utf8").trim()).toBe("0.55.1");
  });

  it("skips the copy when that version is already there", () => {
    const packageDir = fakePackage("0.55.1", { "loader.js": "loader" });
    const targetDir = join(dir, "public", "monaco");
    copyMonaco({ packageDir, targetDir });
    writeFileSync(join(targetDir, "vs", "loader.js"), "untouched");

    expect(copyMonaco({ packageDir, targetDir })).toEqual({ version: "0.55.1", copied: false });
    expect(readFileSync(join(targetDir, "vs", "loader.js"), "utf8")).toBe("untouched");
  });

  it("replaces a copy of another version, leaving none of its files behind", () => {
    const targetDir = join(dir, "public", "monaco");
    copyMonaco({ packageDir: fakePackage("0.54.0", { "loader.js": "old", "gone.js": "old" }), targetDir });

    const result = copyMonaco({ packageDir: fakePackage("0.55.1", { "loader.js": "new" }), targetDir });

    expect(result).toEqual({ version: "0.55.1", copied: true });
    expect(readFileSync(join(targetDir, "vs", "loader.js"), "utf8")).toBe("new");
    expect(existsSync(join(targetDir, "vs", "gone.js"))).toBe(false);
  });

  it("copies again when an earlier copy is incomplete", () => {
    const packageDir = fakePackage("0.55.1", { "loader.js": "loader" });
    const targetDir = join(dir, "public", "monaco");
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, "VERSION"), "0.55.1\n");

    expect(copyMonaco({ packageDir, targetDir }).copied).toBe(true);
    expect(existsSync(join(targetDir, "vs", "loader.js"))).toBe(true);
  });
});

describe("loaderMonacoVersion", () => {
  it("reads the version from the loader's CDN default", () => {
    const source = "var config = { paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs' } };";
    expect(loaderMonacoVersion(source)).toBe("0.55.1");
    expect(loaderMonacoVersion("var config = {};")).toBeNull();
  });

  it("matches the installed monaco-editor, which is what the app serves", () => {
    const require = createRequire(import.meta.url);
    const loaderConfig = readFileSync(
      join(dirname(require.resolve("@monaco-editor/loader")), "config", "index.js"),
      "utf8",
    );
    const installed = JSON.parse(readFileSync(require.resolve("monaco-editor/package.json"), "utf8")).version;
    expect(loaderMonacoVersion(loaderConfig)).toBe(installed);
  });
});
