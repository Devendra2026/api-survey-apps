import { z } from "zod"

export const UserStatusSchema = z.enum(["ACTIVE", "INVITED", "SUSPENDED", "DEACTIVATED"])

/**
 * Upsert identity after Clerk JWT validation (no password).
 * Maps to User.fullName in Prisma (Clerk first/last → fullName at service layer,
 * or pass fullName / displayName directly).
 */
export const UpsertClerkUserSchema = z
  .object({
    clerkUserId: z.string().min(1).max(255),
    email: z.email(),
    fullName: z.string().min(1).max(255).optional(),
    firstName: z.string().min(1).max(120).optional(),
    lastName: z.string().min(1).max(120).optional(),
    displayName: z.string().min(1).max(255).optional(),
    phone: z.string().max(32).optional(),
    designation: z.string().max(120).optional(),
  })
  .refine(
    (data) =>
      Boolean(data.fullName?.trim()) ||
      Boolean(data.displayName?.trim()) ||
      (Boolean(data.firstName?.trim()) && Boolean(data.lastName?.trim())),
    {
      message: "Provide fullName, displayName, or both firstName and lastName",
    }
  )

export type UpsertClerkUserDto = z.infer<typeof UpsertClerkUserSchema>

/** Resolve Prisma User.fullName from an upsert DTO. */
export function resolveUserFullName(data: UpsertClerkUserDto): string {
  if (data.fullName?.trim()) return data.fullName.trim()
  if (data.displayName?.trim()) return data.displayName.trim()
  return `${data.firstName?.trim() ?? ""} ${data.lastName?.trim() ?? ""}`.trim()
}

export const UpdateUserProfileSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().min(1).max(120).optional(),
  displayName: z.string().min(1).max(255).optional(),
  phone: z.string().max(32).nullable().optional(),
  designation: z.string().max(120).nullable().optional(),
  avatarFileId: z.uuid().nullable().optional(),
})

export type UpdateUserProfileDto = z.infer<typeof UpdateUserProfileSchema>

export const UpdateUserStatusSchema = z.object({
  status: UserStatusSchema,
  remarks: z.string().max(2000).optional(),
})

export type UpdateUserStatusDto = z.infer<typeof UpdateUserStatusSchema>
