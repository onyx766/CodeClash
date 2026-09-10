import { request } from "../lib/api";
import type {
  AdminChallenge,
  AdminChallengeSummary,
  AiGenerateRequest,
  ChallengeStatus,
  UpsertChallengePayload,
  ValidationCheck,
  ValidationStatus,
} from "../lib/types";

/**
 * Thin wrapper over /api/admin/challenges. Every call goes through the shared
 * client, so all of them carry the httpOnly auth cookies and unwrap the
 * backend's error envelope into an ApiError with its `code`.
 */

export interface ValidationResponse {
  validation: {
    status: ValidationStatus;
    validatedAt: string;
    checks: ValidationCheck[];
  };
}

export const challengeService = {
  list: (params: { status?: ChallengeStatus; search?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.search) query.set("search", params.search);
    const suffix = query.toString() ? `?${query}` : "";
    return request<{ challenges: AdminChallengeSummary[] }>(
      "GET",
      `/admin/challenges${suffix}`,
    );
  },

  get: (id: string) =>
    request<{ challenge: AdminChallenge }>("GET", `/admin/challenges/${id}`),

  /** Creates a DRAFT. The server ignores any lifecycle field sent here. */
  createDraft: (payload: UpsertChallengePayload) =>
    request<{ challenge: AdminChallenge }>("POST", "/admin/challenges", payload),

  updateDraft: (id: string, payload: UpsertChallengePayload) =>
    request<{ challenge: AdminChallenge }>(
      "PATCH",
      `/admin/challenges/${id}`,
      payload,
    ),

  remove: (id: string) =>
    request<{ success: true }>("DELETE", `/admin/challenges/${id}`),

  /** Runs the challenge through the isolated code runner, server-side. */
  validate: (id: string) =>
    request<ValidationResponse>("POST", `/admin/challenges/${id}/validate`),

  publish: (id: string) =>
    request<{ challenge: AdminChallenge }>(
      "POST",
      `/admin/challenges/${id}/publish`,
    ),

  archive: (id: string) =>
    request<{ challenge: AdminChallenge }>(
      "POST",
      `/admin/challenges/${id}/archive`,
    ),

  /** Uploads challenge JSON. Always lands as a DRAFT for review. */
  import: (content: string, fileName?: string, mimeType?: string) =>
    request<{ challenge: AdminChallenge }>("POST", "/admin/challenges/import", {
      content,
      fileName,
      mimeType,
    }),

  downloadTemplate: () =>
    request<{ template: Record<string, unknown> }>(
      "GET",
      "/admin/challenges/import/template",
    ),

  aiStatus: () =>
    request<{ configured: boolean; message: string }>(
      "GET",
      "/admin/challenges/ai/status",
    ),

  /**
   * Returns a draft-compatible structure for review. Nothing is persisted -
   * the admin saves it themselves once they have looked at it.
   */
  generateWithAI: (payload: AiGenerateRequest) =>
    request<{ draft: UpsertChallengePayload }>(
      "POST",
      "/admin/challenges/ai/generate",
      payload,
    ),

  saveGenerated: (payload: UpsertChallengePayload) =>
    request<{ challenge: AdminChallenge }>(
      "POST",
      "/admin/challenges/ai/save",
      payload,
    ),
};
