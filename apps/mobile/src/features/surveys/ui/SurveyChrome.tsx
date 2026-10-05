import { Button, Text } from "@/components/ui"
import { colors, radius, spacing, touchTarget } from "@/theme"
import type { ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type { FieldBucket } from "../lib/lifecycle"
import { stepOrdinal } from "../lib/navigation"
import { STEP_TITLES, type StepId } from "../lib/requirements"
import type { SyncStatus } from "../lib/sync-state"
import { StatusBadge, SyncChip } from "./primitives"

export function SurveyProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={styles.progressTrack}
    >
      <View style={[styles.progressFill, { width: `${clamped}%` }]} />
    </View>
  )
}

export function SurveyHeader({
  propertyId,
  wardLine,
  step,
  completionPercent,
  editable,
  bucket,
  syncStatus,
  onBack,
  onRetrySync,
}: {
  propertyId: string
  wardLine: string
  step: StepId
  completionPercent: number
  editable: boolean
  bucket: FieldBucket
  syncStatus: SyncStatus
  onBack: () => void
  onRetrySync: () => void
}) {
  const ordinal = stepOrdinal(step)
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.back}
          hitSlop={8}
        >
          <Text variant="bodyStrong" tone="primary">
            ‹ Back
          </Text>
        </Pressable>
        {editable ? <SyncChip status={syncStatus} onRetry={onRetrySync} /> : <StatusBadge bucket={bucket} />}
      </View>

      <Text variant="heading" numberOfLines={1}>
        {propertyId}
      </Text>

      <View style={styles.headerRow}>
        <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.flex}>
          {wardLine}
        </Text>
        {editable ? <StatusBadge bucket={bucket} /> : null}
      </View>

      <View style={styles.metaRow}>
        <Text variant="label" tone="primary">
          {STEP_TITLES[step]}
        </Text>
        <Text variant="caption" tone="secondary">
          {ordinal.label} · {completionPercent}%
        </Text>
      </View>
      <SurveyProgressBar percent={completionPercent} />
    </View>
  )
}

export function BottomActionBar({
  canGoBack,
  canGoNext,
  nextDisabledReason,
  nextTitle,
  editable,
  isLast,
  submitting,
  savingDraft,
  onBack,
  onSaveDraft,
  onNext,
  onSubmit,
  onDone,
}: {
  canGoBack: boolean
  canGoNext: boolean
  nextDisabledReason: string | null
  nextTitle: string
  editable: boolean
  isLast: boolean
  submitting: boolean
  savingDraft: boolean
  onBack: () => void
  onSaveDraft: () => void
  onNext: () => void
  onSubmit: () => void
  onDone: () => void
}) {
  return (
    <View style={styles.footer}>
      {nextDisabledReason && !isLast ? (
        <Text variant="caption" tone="danger" numberOfLines={2}>
          {nextDisabledReason}
        </Text>
      ) : null}
      <View style={styles.footerRow}>
        <Button title="Back" variant="secondary" disabled={!canGoBack} onPress={onBack} style={styles.flex} />
        {editable ? (
          <Button
            title={savingDraft ? "Saving…" : "Save draft"}
            variant="ghost"
            loading={savingDraft}
            disabled={savingDraft || submitting}
            onPress={onSaveDraft}
            style={styles.flex}
          />
        ) : null}
        {isLast ? (
          editable ? (
            <Button
              title={submitting ? "Submitting…" : nextTitle}
              loading={submitting}
              disabled={!canGoNext || submitting || savingDraft}
              onPress={onSubmit}
              style={styles.flex2}
            />
          ) : (
            <Button title="Done" onPress={onDone} style={styles.flex2} />
          )
        ) : (
          <Button
            title={nextTitle}
            disabled={!canGoNext}
            onPress={onNext}
            style={styles.flex2}
          />
        )}
      </View>
      {isLast && editable && nextDisabledReason ? (
        <Text variant="caption" tone="danger" numberOfLines={2}>
          {nextDisabledReason}
        </Text>
      ) : null}
    </View>
  )
}

export function ValidationBanner({
  title,
  children,
  tone = "danger",
}: {
  title: string
  children: ReactNode
  tone?: "danger" | "warning"
}) {
  const warning = tone === "warning"
  return (
    <View style={[styles.banner, warning && styles.bannerWarning]} accessibilityRole="alert">
      <Text variant="label" tone={warning ? "default" : "danger"} style={warning ? styles.warningTitle : undefined}>
        {title}
      </Text>
      {children}
    </View>
  )
}

export function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string
  value: string
  onEdit?: () => void
}) {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.flex}>
        <Text variant="caption" tone="secondary">
          {label}
        </Text>
        <Text variant="bodyStrong">{value || "—"}</Text>
      </View>
      {onEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${label}`}
          onPress={onEdit}
          style={styles.editHit}
          hitSlop={8}
        >
          <Text variant="label" tone="primary">
            Edit
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  back: {
    minHeight: touchTarget,
    justifyContent: "center",
    paddingRight: spacing.md,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  footer: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  flex: { flex: 1 },
  flex2: { flex: 2 },
  banner: {
    gap: spacing.xs,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.dangerMuted,
  },
  bannerWarning: {
    backgroundColor: colors.warningMuted,
    marginBottom: 0,
  },
  warningTitle: {
    color: colors.warning,
  },
  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: touchTarget,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  editHit: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
})
