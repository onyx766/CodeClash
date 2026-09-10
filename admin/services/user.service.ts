import { request } from "../lib/api";
import type {
  AdminUpdateUserPayload,
  AdminUser,
  AdminUserDetail,
  CreateUserPayload,
  ListUsersQuery,
  Pagination,
  UserRole,
  UserStats,
} from "../lib/types";

/**
 * Wrapper over /api/admin/users. Every rule about who may do what to whom is
 * enforced server-side; the UI only uses the caller's role to decide what to
 * *offer*.
 */
export const userService = {
  list: (query: ListUsersQuery = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const suffix = params.toString() ? `?${params}` : "";
    return request<{ users: AdminUser[]; pagination: Pagination }>(
      "GET",
      `/admin/users${suffix}`,
    );
  },

  stats: () => request<{ stats: UserStats }>("GET", "/admin/users/stats"),

  get: (id: string) =>
    request<{ user: AdminUserDetail }>("GET", `/admin/users/${id}`),

  create: (payload: CreateUserPayload) =>
    request<{ user: AdminUser }>("POST", "/admin/users", payload),

  /** Account and profile details only - role and ban have their own calls. */
  update: (id: string, payload: AdminUpdateUserPayload) =>
    request<{ user: AdminUserDetail }>("PATCH", `/admin/users/${id}`, payload),

  /** Sets a new password and signs the account out of every session. */
  resetPassword: (id: string, password: string) =>
    request<{ success: true; sessionsRevokedAt: string }>(
      "POST",
      `/admin/users/${id}/password`,
      { password },
    ),

  ban: (id: string, reason?: string) =>
    request<{ user: AdminUser }>("POST", `/admin/users/${id}/ban`, { reason }),

  unban: (id: string) =>
    request<{ user: AdminUser }>("POST", `/admin/users/${id}/unban`),

  /** MASTER-only on the server. */
  changeRole: (id: string, role: UserRole) =>
    request<{ success: true; user: AdminUser }>(
      "PATCH",
      `/admin/users/${id}/role`,
      { role },
    ),
};
