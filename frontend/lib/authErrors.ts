import { ApiError } from "./api";

/** What to tell the player when signing in or up fails. */
export function authErrorMessage(err: unknown, unauthorized: string): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return "Cannot reach the server. Check your connection and try again.";
    if (err.status === 401) return unauthorized;
    // Banned, rate-limited, validation errors, taken email or username...
    if (err.status < 500) return err.message;
  }
  return "Something went wrong on our side. Please try again.";
}
