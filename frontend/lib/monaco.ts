import type { loader as monacoLoader } from "@monaco-editor/react";

/**
 * Where the app serves the Monaco editor: public/monaco/vs, copied from the
 * monaco-editor package by scripts/copy-monaco.mjs before every dev start and
 * build.
 */
export const MONACO_VS_PATH = "/monaco/vs";

/**
 * Points @monaco-editor/react at the self-hosted copy. Without this it loads
 * Monaco from cdn.jsdelivr.net, which fails on offline and LAN installs and
 * sends every player's IP address to a third party. Must run before the first
 * editor mounts.
 */
export function configureSelfHostedMonaco(loader: Pick<typeof monacoLoader, "config">) {
  loader.config({ paths: { vs: MONACO_VS_PATH } });
}
