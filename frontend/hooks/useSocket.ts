"use client";

import { useSyncExternalStore } from "react";
import type { Socket } from "socket.io-client";
import { getSocket, subscribeSocket } from "../lib/socket";

const noSocket = () => null;

/**
 * The signed-in player's socket, or null when signed out. It is a new
 * instance after a login, a logout or a session refresh: list it in the
 * dependencies of any effect that attaches listeners or joins a channel.
 */
export default function useSocket(): Socket | null {
  return useSyncExternalStore(subscribeSocket, getSocket, noSocket);
}
