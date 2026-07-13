export const PERMISSIONS = {
  SURVEY_CREATE: "survey:create",
  SURVEY_UPDATE: "survey:update",
  SURVEY_DELETE: "survey:delete",
  SURVEY_VIEW: "survey:view",
  SURVEY_SUBMIT: "survey:submit",
  SURVEY_APPROVE: "survey:approve",
  SURVEY_REJECT: "survey:reject",
  SURVEY_ASSIGN: "survey:assign",
  USER_CREATE: "user:create",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",
  USER_VIEW: "user:view",
  ROLE_ASSIGN: "role:assign",
  DASHBOARD_VIEW: "dashboard:view",
  REPORT_VIEW: "report:view",
  REPORT_EXPORT: "report:export",
  PHOTO_CREATE: "photo:create",
  PHOTO_UPDATE: "photo:update",
  PHOTO_DELETE: "photo:delete",
} as const

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
