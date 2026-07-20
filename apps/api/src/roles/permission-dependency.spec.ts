import { requiredViewPermission, validateViewDependencies } from "./permission-dependency.js"

describe("permission-dependency", () => {
  describe("requiredViewPermission", () => {
    it("returns null for view permissions", () => {
      expect(requiredViewPermission("survey:view")).toBeNull()
    })

    it("returns resource:view for non-view actions", () => {
      expect(requiredViewPermission("survey:create")).toBe("survey:view")
      expect(requiredViewPermission("user:update")).toBe("user:view")
      expect(requiredViewPermission("role:assign")).toBe("role:view")
    })

    it("returns null for malformed names", () => {
      expect(requiredViewPermission("noview")).toBeNull()
      expect(requiredViewPermission(":create")).toBeNull()
    })
  })

  describe("validateViewDependencies", () => {
    it("fails when view is missing and view exists in catalog", () => {
      const catalog = new Set(["survey:view", "survey:create"])
      expect(validateViewDependencies(["survey:create"], catalog)).toContain("survey:view")
    })

    it("skips when matching view is not in catalog", () => {
      const catalog = new Set(["role:assign"])
      expect(validateViewDependencies(["role:assign"], catalog)).toBeNull()
    })

    it("passes when view is present", () => {
      expect(validateViewDependencies(["survey:view", "survey:create"])).toBeNull()
    })

    it("fails when view is missing without catalog filter", () => {
      expect(validateViewDependencies(["survey:create"])).toContain("survey:view")
    })

    it("passes view-only sets", () => {
      expect(validateViewDependencies(["dashboard:view"])).toBeNull()
    })
  })
})
