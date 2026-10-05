import { colors } from "@/theme"

/** Material 3 outlined-field colors seeded with the municipal navy. */
export const outlinedFieldColors = {
  focusedTextColor: colors.text,
  unfocusedTextColor: colors.text,
  disabledTextColor: colors.textSecondary,
  errorTextColor: colors.danger,
  focusedContainerColor: colors.surface,
  unfocusedContainerColor: colors.surface,
  disabledContainerColor: colors.surfaceMuted,
  focusedIndicatorColor: colors.primary,
  unfocusedIndicatorColor: colors.border,
  errorIndicatorColor: colors.danger,
  focusedLabelColor: colors.primary,
  unfocusedLabelColor: colors.textSecondary,
  focusedPlaceholderColor: colors.textSecondary,
  unfocusedPlaceholderColor: colors.textSecondary,
  focusedSupportingTextColor: colors.textSecondary,
  unfocusedSupportingTextColor: colors.textSecondary,
  errorSupportingTextColor: colors.danger,
  focusedTrailingIconColor: colors.primary,
  unfocusedTrailingIconColor: colors.primary,
} as const
