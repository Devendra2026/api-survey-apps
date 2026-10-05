import { apiDelete, apiGet, apiPost } from "@/lib/api/client"

export interface UlbPinCodeItem {
  readonly id: string
  readonly code: string
}

export function listUlbPinCodes(ulbId: string): Promise<UlbPinCodeItem[]> {
  return apiGet<UlbPinCodeItem[]>(`/ulbs/${ulbId}/pin-codes`)
}

export function createUlbPinCode(ulbId: string, code: string): Promise<UlbPinCodeItem> {
  return apiPost<UlbPinCodeItem>(`/ulbs/${ulbId}/pin-codes`, { code })
}

export async function deleteUlbPinCode(ulbId: string, pinCodeId: string): Promise<void> {
  await apiDelete<unknown>(`/ulbs/${ulbId}/pin-codes/${pinCodeId}`)
}
