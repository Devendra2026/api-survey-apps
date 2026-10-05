import { Text } from "@/components/ui"
import { colors, radius, spacing, touchTarget } from "@/theme"
import type { ReactNode } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import type { FieldBucket } from "../lib/lifecycle"
import { stepOrdinal } from "../lib/navigation"
import { HEADER_TITLES, STEP_IDS, type StepId, type StepProgress } from "../lib/requirements"
import type { SyncStatus } from "../lib/sync-state"
import { FooterButtons, type FooterButton } from "./footer-buttons"
import { StatusBadge, StepChips, SyncChip } from "./primitives"
import { SurveyProgressBar } from "./survey-progress"

export function SurveyHeader({
  propertyId,
  wardLine,
  step,
  progress,
  completionPercent,
  editable,
  bucket,
  syncStatus,
  onBack,
  onRetrySync,
  onSelectStep,
  onNewSurvey,
  isStepEnabled,
}: {
  propertyId: string
  wardLine: string
  step: StepId
  progress: Record<StepId, StepProgress>
  completionPercent: number
  editable: boolean
  bucket: FieldBucket
  syncStatus: SyncStatus
  onBack: () => void
  onRetrySync: () => void
  onSelectStep: (step: StepId) => void
  onNewSurvey?: () => void
  isStepEnabled?: (step: StepId) => boolean
}) {
  const ordinal = stepOrdinal(step)
  const title = HEADER_TITLES[step]
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Text variant="caption" tone="inverse" style={styles.kicker}>
          {editable ? "New survey" : "Survey"}
        </Text>
        {editable ? <SyncChip status={syncStatus} onRetry={onRetrySync} /> : <StatusBadge bucket={bucket} />}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Back from ${title}`}
        onPress={onBack}
        style={styles.titleRow}
        hitSlop={8}
      >
        <Text variant="heading" tone="inverse">
          ‹  {title}
        </Text>
      </Pressable>
      <Text variant="caption" style={styles.meta}>
        {ordinal.label} · {title} · {completionPercent}% · Jump to any step
      </Text>
      <SurveyProgressBar percent={completionPercent} onPrimary />
      <View style={styles.chipRow}>
        <View style={styles.flex}>
          <StepChips
            steps={STEP_IDS}
            current={step}
            progress={progress}
            onSelect={onSelectStep}
            variant="header"
            isStepEnabled={isStepEnabled}
          />
        </View>
        {editable && onNewSurvey ? (
          <Pressable accessibilityRole="button" accessibilityLabel="New survey" onPress={onNewSurvey} hitSlop={8}>
            <Text variant="caption" tone="inverse" style={styles.newSurvey}>
              + New survey
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Text variant="caption" numberOfLines={1} style={styles.meta}>
        {propertyId}
        {wardLine ? ` · ${wardLine}` : ""}
      </Text>
    </View>
  )
}

export function BottomActionBar({
  canGoBack,
  canGoNext,
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
  const buttons: FooterButton[] = [
    { title: "Back", onPress: onBack, disabled: !canGoBack, variant: "secondary", flex: 1 },
  ]
  if (editable) {
    buttons.push({
      title: "Save draft",
      onPress: onSaveDraft,
      disabled: savingDraft || submitting,
      loading: savingDraft,
      variant: "secondary",
      flex: 1.2,
    })
  }
  if (isLast) {
    buttons.push(
      editable
        ? {
          title: submitting ? "Submitting…" : nextTitle,
          onPress: onSubmit,
          disabled: !canGoNext || submitting || savingDraft,
          variant: "primary",
          flex: 1.6,
        }
        : { title: "Done", onPress: onDone, variant: "primary", flex: 1.6 },
    )
  } else {
    buttons.push({ title: nextTitle, onPress: onNext, disabled: !canGoNext, variant: "primary", flex: 1.6 })
  }
  return (
    <View style={styles.footer}>
      <FooterButtons buttons={buttons} />
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
      {warning ? (
        <View style={styles.warningMark}>
          <Text variant="caption" tone="inverse">
            !
          </Text>
        </View>
      ) : null}
      <View style={styles.flex}>
        <Text variant="label" tone={warning ? "default" : "danger"} style={warning ? styles.warningTitle : undefined}>
          {title}
        </Text>
        {children}
      </View>
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
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.primary,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  kicker: { opacity: 0.9 },
  titleRow: { minHeight: touchTarget, justifyContent: "center" },
  chipRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  newSurvey: { fontWeight: "600" },
  meta: { color: "rgba(255,255,255,0.85)" },
  footer: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
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
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.warningMuted,
    borderRadius: radius.md,
    marginBottom: 0,
  },
  warningMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warning,
  },
  warningTitle: {
    color: colors.warning,
    fontWeight: "700",
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
