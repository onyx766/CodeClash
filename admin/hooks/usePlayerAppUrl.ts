"use client";

import { useSyncExternalStore } from "react";

/**
 * Where the player app lives, for the "Main site" links.
 *
 * NEXT_PUBLIC_PLAYER_APP_URL wins when it was set at build time. Otherwise the
 * player app is assumed to run on port 3000 of whatever host the browser
 * loaded the console from - the same rule lib/api.ts uses for the API on port
 * 4000 - so a LAN or server deployment does not link to the viewer's own
 * localhost.
 *
 * The server render (and the hydration pass) use the localhost fallback, and
 * React switches to the browser's value straight after hydrating, so the
 * markup never mismatches.
 */

const configured = process.env.NEXT_PUBLIC_PLAYER_APP_URL;

const fromBrowser = () =>
  configured || `${window.location.protocol}//${window.location.hostname}:3000`;

const fromServer = () => configured || "http://localhost:3000";

// The location does not change while the console is open.
const subscribe = () => () => {};

export function usePlayerAppUrl(): string {
  return useSyncExternalStore(subscribe, fromBrowser, fromServer);
}
