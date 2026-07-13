import type { PaginationQueryDto } from "../dto/pagination-query.dto.js"
import type { PaginatedResult } from "../interfaces/api-response.interface.js"

export function getSkipTake(query: PaginationQueryDto): { skip: number; take: number; page: number; limit: number } {
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
  }
}

export function toPaginatedResult<T>(items: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  }
}

export function buildOrderBy(
  sortBy: string | undefined,
  sortOrder: "asc" | "desc" | undefined,
  allowed: string[],
  fallback = "createdAt"
): Record<string, "asc" | "desc"> {
  const field = sortBy && allowed.includes(sortBy) ? sortBy : fallback
  return { [field]: sortOrder === "asc" ? "asc" : "desc" }
}
