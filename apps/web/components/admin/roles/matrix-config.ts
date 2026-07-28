/**
 * Enterprise RBAC matrix: modules × actions.
 * Each cell maps to at most one catalog permission name.
 * Empty cells are intentionally unavailable (not seeded yet).
 */

export const MATRIX_ACTIONS = [
  { id: "view", label: "View" },
  { id: "create", label: "Create" },
  { id: "edit", label: "Edit" },
  { id: "delete", label: "Delete" },
  { id: "approve", label: "Approve" },
  { id: "reject", label: "Reject" },
  { id: "export", label: "Export" },
  { id: "import", label: "Import" },
  { id: "assign", label: "Assign" },
  { id: "manage", label: "Manage" },
  { id: "publish", label: "Publish" },
  { id: "archive", label: "Archive" },
  { id: "restore", label: "Restore" },
  { id: "print", label: "Print" },
  { id: "share", label: "Share" },
] as const

export type MatrixActionId = (typeof MATRIX_ACTIONS)[number]["id"]

/** Primary columns shown first; remaining actions keep their relative order from MATRIX_ACTIONS. */
const PRIMARY_ACTION_ORDER: MatrixActionId[] = ["view", "create", "edit", "delete", "manage"]

export const MATRIX_DISPLAY_ACTIONS = [
  ...PRIMARY_ACTION_ORDER.flatMap((id) => {
    const action = MATRIX_ACTIONS.find((a) => a.id === id)
    return action ? [action] : []
  }),
  ...MATRIX_ACTIONS.filter((a) => !PRIMARY_ACTION_ORDER.includes(a.id)),
] as const

export type MatrixModuleIcon =
  | "layout-dashboard"
  | "users"
  | "shield"
  | "map"
  | "map-pin"
  | "building-2"
  | "landmark"
  | "clipboard-list"
  | "badge-check"
  | "file-bar-chart"
  | "upload"
  | "camera"
  | "database"
  | "settings"
  | "scroll-text"
  | "key"
  | "bell"

export type MatrixModuleDef = {
  id: string
  label: string
  description: string
  icon: MatrixModuleIcon
  /** Permission catalog name per action column; omit = N/A */
  cells: Partial<Record<MatrixActionId, string>>
}

/** Geo controllers use survey:view for read and role:assign for mutate. */
const GEO_CELLS: Partial<Record<MatrixActionId, string>> = {
  view: "survey:view",
  create: "role:assign",
  edit: "role:assign",
  delete: "role:assign",
}

export const MATRIX_MODULES: MatrixModuleDef[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Executive and operational dashboards",
    icon: "layout-dashboard",
    cells: { view: "dashboard:view" },
  },
  {
    id: "users",
    label: "Users",
    description: "Directory, lifecycle, and password reset",
    icon: "users",
    cells: {
      view: "user:view",
      create: "user:create",
      edit: "user:update",
      delete: "user:delete",
      manage: "user:reset_password",
    },
  },
  {
    id: "roles",
    label: "Roles",
    description: "Role assignment and RBAC administration",
    icon: "shield",
    cells: {
      view: "user:view",
      assign: "role:assign",
      manage: "role:assign",
    },
  },
  {
    id: "states",
    label: "States",
    description: "Geographic state master",
    icon: "map",
    cells: GEO_CELLS,
  },
  {
    id: "districts",
    label: "Districts",
    description: "Geographic district master",
    icon: "map-pin",
    cells: GEO_CELLS,
  },
  {
    id: "blocks",
    label: "Blocks",
    description: "Geographic block master (uses ULB APIs)",
    icon: "building-2",
    cells: GEO_CELLS,
  },
  {
    id: "ulbs",
    label: "ULBs",
    description: "Urban local body master",
    icon: "landmark",
    cells: GEO_CELLS,
  },
  {
    id: "wards",
    label: "Wards",
    description: "Ward master",
    icon: "map-pin",
    cells: GEO_CELLS,
  },
  {
    id: "survey",
    label: "Survey",
    description: "Field survey capture and workflow",
    icon: "clipboard-list",
    cells: {
      view: "survey:view",
      create: "survey:create",
      edit: "survey:update",
      delete: "survey:delete",
      export: "survey:export",
      import: "survey:import",
      assign: "survey:assign",
      manage: "survey:submit",
    },
  },
  {
    id: "qc",
    label: "QC Review",
    description: "Quality control approve / reject",
    icon: "badge-check",
    cells: {
      view: "survey:view",
      edit: "survey:update",
      approve: "survey:approve",
      reject: "survey:reject",
      export: "report:export",
    },
  },
  {
    id: "photos",
    label: "Photos",
    description: "Survey photo capture and management",
    icon: "camera",
    cells: {
      view: "survey:view",
      create: "photo:create",
      edit: "photo:update",
      delete: "photo:delete",
    },
  },
  {
    id: "reports",
    label: "Reports",
    description: "Operational reporting",
    icon: "file-bar-chart",
    cells: {
      view: "report:view",
      export: "report:export",
    },
  },
  {
    id: "import",
    label: "Import",
    description: "Bulk data import pipelines",
    icon: "upload",
    cells: {
      view: "survey:view",
      import: "survey:import",
      manage: "survey:import",
    },
  },
  {
    id: "etl",
    label: "ETL Sync",
    description: "Convex → Postgres / MinIO migration control plane",
    icon: "upload",
    cells: {
      manage: "etl:manage",
    },
  },
  {
    id: "master",
    label: "Configuration",
    description: "Reference catalogs, geography, and tax engine",
    icon: "database",
    cells: {
      view: "settings:view",
      edit: "settings:manage",
      manage: "settings:manage",
      publish: "settings:publish",
    },
  },
  {
    id: "settings",
    label: "Settings",
    description: "System configuration",
    icon: "settings",
    cells: {
      view: "settings:view",
      manage: "settings:manage",
    },
  },
  {
    id: "audit",
    label: "Audit Logs",
    description: "Security and permission change history",
    icon: "scroll-text",
    cells: {
      view: "user:view",
      export: "report:export",
    },
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Operational alerts",
    icon: "bell",
    cells: {
      view: "dashboard:view",
      manage: "settings:manage",
    },
  },
  {
    id: "api",
    label: "API Access",
    description: "Programmatic API scopes",
    icon: "key",
    cells: {
      view: "settings:view",
      manage: "settings:manage",
    },
  },
]

/** Default permission profiles shown when switching system roles (informational overlay) */
export const ROLE_PERMISSION_HINTS: Record<string, string> = {
  PENDING_APPROVAL: "No permissions until an Admin assigns a working role.",
  SURVEYOR: "Survey capture only — scoped to assigned geography.",
  FIELD_SUPERVISOR: "Survey oversight plus operational reports.",
  QC_SUPERVISOR: "Survey visibility with QC approve / reject.",
  ADMIN: "Full access across every module and action.",
  DEPT_ADMIN: "Municipal admin — manage users and roles within the ULB client.",
  DEPT_CLERK: "Municipal clerk — office review and reporting within the ULB.",
  DEPT_OPERATOR: "Municipal operator — field survey capture within the ULB.",
}
