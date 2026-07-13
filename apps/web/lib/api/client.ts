import axios, { type AxiosError, type AxiosRequestConfig } from "axios"
import type { ApiResponse, PaginatedResult } from "./types"

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

export const apiClient = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
})

let tokenGetter: (() => Promise<string | null>) | null = null

export function setApiTokenGetter(getter: () => Promise<string | null>) {
  tokenGetter = getter
}

apiClient.interceptors.request.use(async (config) => {
  if (tokenGetter) {
    const token = await tokenGetter()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiResponse | undefined
    if (data?.message) return data.message
    if (Array.isArray(data?.errors) && data.errors.length > 0) {
      const first = data.errors[0]
      if (typeof first === "string") return first
      if (typeof first === "object" && first !== null && "message" in first) {
        return String((first as { message: string }).message)
      }
    }
    return error.message
  }
  if (error instanceof Error) return error.message
  return "An unexpected error occurred"
}

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await apiClient.get<ApiResponse<T>>(url, config)
  if (!data.success) throw new Error(data.message || "Request failed")
  return data.data as T
}

export async function apiGetPaginated<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<PaginatedResult<T>> {
  return apiGet<PaginatedResult<T>>(url, config)
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await apiClient.post<ApiResponse<T>>(url, body, config)
  if (!data.success) throw new Error(data.message || "Request failed")
  return data.data as T
}

export async function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await apiClient.patch<ApiResponse<T>>(url, body, config)
  if (!data.success) throw new Error(data.message || "Request failed")
  return data.data as T
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await apiClient.delete<ApiResponse<T>>(url, config)
  if (!data.success) throw new Error(data.message || "Request failed")
  return data.data as T
}

export async function apiUpload<T>(
  url: string,
  formData: FormData,
  config?: AxiosRequestConfig
): Promise<T> {
  const { data } = await apiClient.post<ApiResponse<T>>(url, formData, {
    ...config,
    headers: { ...config?.headers, "Content-Type": "multipart/form-data" },
  })
  if (!data.success) throw new Error(data.message || "Upload failed")
  return data.data as T
}

export type { AxiosError }
