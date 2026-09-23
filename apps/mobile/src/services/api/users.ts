import { apiGet, apiPost } from "@/services/api/client";
import type { AuthenticatedProfile } from "@/types/user";

export type SyncUserInput = {
  fullName?: string;
  phone?: string;
};

export function getMe(): Promise<AuthenticatedProfile> {
  return apiGet<AuthenticatedProfile>("/users/me");
}

export function syncUser(input: SyncUserInput): Promise<AuthenticatedProfile> {
  return apiPost<AuthenticatedProfile>("/users/sync", input);
}
