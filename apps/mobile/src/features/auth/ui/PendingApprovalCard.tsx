import { Button, Text } from "@/components/ui"
import { colors, radius, spacing } from "@/theme"
import type { RequestableRole } from "@/types/user"
import { roleDisplayName } from "@/types/user"
import { StyleSheet, View } from "react-native"
import { RoleRequestPicker } from "./RoleRequestPicker"

type Props = {
  fullName: string
  email: string
  requestedRole?: string | null
  submittedAt?: string | null
  refreshing?: boolean
  submittingRole?: boolean
  onRefresh: () => void
  onSignOut: () => void
  /** When signup never recorded a role, allow one-time selection. */
  onSubmitRequestedRole?: (role: RequestableRole) => void
}

function formatSubmitted(iso: string | null | undefined): string {
  if (!iso) {
    return "Just now"
  }
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

export function PendingApprovalCard({
  fullName,
  email,
  requestedRole,
  submittedAt,
  refreshing = false,
  submittingRole = false,
  onRefresh,
  onSignOut,
  onSubmitRequestedRole,
}: Props) {
  const showRolePicker = !requestedRole && Boolean(onSubmitRequestedRole)

  return (
    <View style={styles.card} accessibilityLabel="Account pending approval">
      <View style={styles.badge}>
        <Text variant="caption" tone="secondary" style={styles.badgeText}>
          Awaiting approval
        </Text>
      </View>

      <Text variant="heading">{fullName || "Your account"}</Text>
      <Text variant="body" tone="secondary">
        {email}
      </Text>

      <Text variant="body" style={styles.message}>
        Your account is being reviewed. You will be routed into the app automatically once an administrator assigns
        your role and survey area.
      </Text>

      <View style={styles.meta}>
        <View style={styles.metaRow}>
          <Text variant="caption" tone="secondary">
            Role
          </Text>
          <Text variant="bodyStrong">
            {requestedRole ? roleDisplayName(requestedRole) : "Not specified yet"}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text variant="caption" tone="secondary">
            Submitted
          </Text>
          <Text variant="bodyStrong">{formatSubmitted(submittedAt)}</Text>
        </View>
      </View>

      {showRolePicker && onSubmitRequestedRole ? (
        <View style={styles.roleBlock}>
          <Text variant="bodyStrong">Select the role you need</Text>
          <RoleRequestPicker
            value={null}
            disabled={submittingRole}
            onChange={(role) => onSubmitRequestedRole(role)}
          />
        </View>
      ) : null}

      <View style={styles.steps}>
        <Text variant="bodyStrong">What happens next</Text>
        <Text variant="caption" tone="secondary">
          1. An administrator reviews your request
        </Text>
        <Text variant="caption" tone="secondary">
          2. Role and wards are assigned
        </Text>
        <Text variant="caption" tone="secondary">
          3. This screen updates and you enter the app
        </Text>
      </View>

      <Button title="Refresh status" loading={refreshing} onPress={onRefresh} />
      <Button title="Sign out" variant="ghost" disabled={refreshing || submittingRole} onPress={onSignOut} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.warningMuted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: colors.warning,
    fontWeight: "600",
  },
  message: {
    marginTop: spacing.xs,
  },
  meta: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  roleBlock: {
    gap: spacing.sm,
  },
  steps: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
})
