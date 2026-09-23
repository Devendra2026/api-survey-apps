import { getApiBaseUrl } from "@/lib/env";

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  errors: string[] | null;
};

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

/**
 * Register a Clerk (or other) session token provider for authenticated requests.
 * Call once from the auth layer when it is wired up.
 */
export function setApiTokenGetter(getter: TokenGetter): void {
  tokenGetter = getter;
}

export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly errors: string[] | null;

  constructor(message: string, statusCode: number, errors: string[] | null = null) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

async function buildHeaders(init?: HeadersInit): Promise<Headers> {
  const headers = new Headers(init);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (tokenGetter) {
    const token = await tokenGetter();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return headers;
}

function resolveUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const base = getApiBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiClientError(
      `Invalid JSON response (${response.status})`,
      response.status,
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("success" in body) ||
    typeof (body as ApiEnvelope<unknown>).success !== "boolean"
  ) {
    if (!response.ok) {
      throw new ApiClientError(`Request failed (${response.status})`, response.status);
    }
    return body as T;
  }

  const envelope = body as ApiEnvelope<T>;
  if (!envelope.success || !response.ok) {
    throw new ApiClientError(
      envelope.message || `Request failed (${response.status})`,
      response.status,
      envelope.errors,
    );
  }
  return envelope.data;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = await buildHeaders(init.headers);
  const response = await fetch(resolveUrl(path), {
    ...init,
    headers,
  });
  return parseEnvelope<T>(response);
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "GET" });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "DELETE" });
}