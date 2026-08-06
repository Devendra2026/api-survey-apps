import { normalizeWardNumber } from "@workspace/validation"
import type { PrismaService } from "../../prisma/prisma.service.js"

/**
 * Map inactive / stray survey wardIds → active ward IDs in the same ULB by
 * normalized ward number. Used by Field + QC Command Centers so cards stay
 * populated when surveys still point at soft-deleted Align leftovers.
 */
export async function resolveWardIdAliases(
  prisma: PrismaService,
  ulbId: string,
  activeWards: Array<{ id: string; wardNumber: string }>
): Promise<Map<string, string>> {
  const activeByNorm = new Map<string, string>()
  for (const ward of activeWards) {
    const norm = normalizeWardNumber(ward.wardNumber)
    if (norm && !activeByNorm.has(norm)) activeByNorm.set(norm, ward.id)
  }

  const inactive = await prisma.db.ward.findMany({
    where: {
      ulbId,
      OR: [{ deletedAt: { not: null } }, { status: "DISABLED" }],
    },
    select: { id: true, wardNumber: true },
  })

  const aliasToActive = new Map<string, string>()
  for (const ward of inactive) {
    const norm = normalizeWardNumber(ward.wardNumber)
    const activeId = norm ? activeByNorm.get(norm) : undefined
    if (activeId && activeId !== ward.id) {
      aliasToActive.set(ward.id, activeId)
    }
  }

  const knownIds = [...activeWards.map((w) => w.id), ...aliasToActive.keys()]
  const strayIds = await prisma.db.survey.findMany({
    where: {
      ulbId,
      deletedAt: null,
      ...(knownIds.length > 0 ? { wardId: { notIn: knownIds } } : {}),
    },
    select: { wardId: true, wardNumber: true },
    distinct: ["wardId"],
  })
  for (const row of strayIds) {
    if (!row.wardId || aliasToActive.has(row.wardId)) continue
    const fromSurvey = row.wardNumber ? normalizeWardNumber(row.wardNumber) : ""
    const activeId = fromSurvey ? activeByNorm.get(fromSurvey) : undefined
    if (activeId) aliasToActive.set(row.wardId, activeId)
  }

  return aliasToActive
}
