import type { GeographyTreeNode } from "@/features/configuration/lib/types"

export type GeoHubStats = {
  states: number
  districts: number
  ulbs: number
  wards: number
}

export function computeGeoStats(tree: GeographyTreeNode[]): GeoHubStats {
  let states = 0
  let districts = 0
  let ulbs = 0
  let wards = 0

  for (const state of tree) {
    if (state.type !== "state") continue
    states += 1
    for (const district of state.children ?? []) {
      if (district.type !== "district") continue
      districts += 1
      for (const ulb of district.children ?? []) {
        if (ulb.type !== "ulb") continue
        ulbs += 1
        const wardChildren = (ulb.children ?? []).filter((c) => c.type === "ward")
        wards += wardChildren.length > 0 ? wardChildren.length : (ulb.counts?.wards ?? 0)
      }
    }
  }

  return { states, districts, ulbs, wards }
}

export type FlatDistrict = {
  id: string
  name: string
  code?: string
  stateId: string
  stateName: string
  ulbs: Array<{ id: string; name: string; wardCount: number }>
}

export function flattenDistricts(tree: GeographyTreeNode[]): FlatDistrict[] {
  const out: FlatDistrict[] = []
  for (const state of tree) {
    if (state.type !== "state") continue
    for (const district of state.children ?? []) {
      if (district.type !== "district") continue
      out.push({
        id: district.id,
        name: district.name,
        code: district.code,
        stateId: state.id,
        stateName: state.name,
        ulbs: (district.children ?? [])
          .filter((u) => u.type === "ulb")
          .map((u) => {
            const wardChildren = (u.children ?? []).filter((c) => c.type === "ward")
            return {
              id: u.id,
              name: u.name,
              wardCount: wardChildren.length > 0 ? wardChildren.length : (u.counts?.wards ?? 0),
            }
          }),
      })
    }
  }
  return out
}
