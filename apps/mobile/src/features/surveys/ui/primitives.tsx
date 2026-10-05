import { Text, TextField, cardStyle } from "@/components/ui"
import { colors, radius, spacing, touchTarget } from "@/theme"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type TextInputProps } from "react-native"
import { optionLabel } from "../lib/labels"
import { FIELD_BUCKET_LABELS, type FieldBucket } from "../lib/lifecycle"
import { SECTION_BLOCKED_MESSAGE } from "../lib/navigation"
import { STEP_MARKS, STEP_TITLES, type StepId, type StepProgress } from "../lib/requirements"
import { syncChip, type SyncChipTone, type SyncStatus } from "../lib/sync-state"

const TONE_STYLES: Record<SyncChipTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceMuted, fg: colors.textSecondary },
  progress: { bg: "#E0E7FF", fg: colors.primary },
  success: { bg: colors.successMuted, fg: colors.success },
  warning: { bg: colors.warningMuted, fg: colors.warning },
  danger: { bg: colors.dangerMuted, fg: colors.danger },
}

const BUCKET_TONE: Record<FieldBucket, SyncChipTone> = {
  draft: "neutral",
  pendingQc: "progress",
  needsCorrection: "danger",
  approved: "success",
}

export function Pill({ label, tone }: { label: string; tone: SyncChipTone }) {
  const t = TONE_STYLES[tone]
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text variant="caption" style={{ color: t.fg, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  )
}

export function StatusBadge({ bucket }: { bucket: FieldBucket }) {
  return <Pill label={FIELD_BUCKET_LABELS[bucket]} tone={BUCKET_TONE[bucket]} />
}

export function SyncChip({ status, onRetry }: { status: SyncStatus; onRetry: () => void }) {
  const chip = syncChip(status)
  const t = TONE_STYLES[chip.tone]
  return (
    <Pressable
      accessibilityRole={chip.canRetry ? "button" : "text"}
      accessibilityLabel={chip.canRetry ? `${chip.label}. Tap to retry` : chip.label}
      disabled={!chip.canRetry}
      onPress={onRetry}
      style={[styles.pill, styles.syncChip, { backgroundColor: t.bg }]}
    >
      {status.kind === "saving" ? <ActivityIndicator size="small" color={t.fg} /> : null}
      <Text variant="caption" style={{ color: t.fg, fontWeight: "600" }}>
        {chip.label}
        {chip.canRetry ? " · Retry" : ""}
      </Text>
    </Pressable>
  )
}

export function StepChips({
  steps,
  current,
  progress,
  onSelect,
  variant = "default",
  isStepEnabled,
}: {
  steps: readonly StepId[]
  current: StepId
  progress: Record<StepId, StepProgress>
  onSelect: (step: StepId) => void
  variant?: "default" | "header"
  isStepEnabled?: (step: StepId) => boolean
}) {
  const scrollRef = useRef<ScrollView>(null)
  const index = steps.indexOf(current)
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: Math.max(0, index - 1) * 72, animated: true })
  }, [index])

  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.steps}>
      {steps.map((step) => {
        const p = progress[step]
        const isCurrent = step === current
        const hasRequiredMissing = p.missing.length > 0
        const done = !hasRequiredMissing && p.filled > 0
        const onHeader = variant === "header"
        const enabled = isStepEnabled?.(step) ?? true
        return (
          <Pressable
            key={step}
            accessibilityRole="tab"
            accessibilityState={{ selected: isCurrent, disabled: !enabled }}
            accessibilityLabel={`${STEP_TITLES[step]}${hasRequiredMissing ? ", required fields missing" : done ? ", complete" : ""}`}
            disabled={!enabled}
            onPress={() => {
              if (enabled) onSelect(step)
            }}
            style={[styles.step, onHeader && styles.stepHeader, !enabled && styles.stepDisabled]}
          >
            <View>
              <View
                style={[
                  styles.stepDot,
                  onHeader && !isCurrent && styles.stepDotHeader,
                  isCurrent && (onHeader ? styles.stepDotCurrentHeader : styles.stepDotCurrent),
                  done && !isCurrent && styles.stepDotDone,
                ]}
              >
                <Text
                  variant="caption"
                  tone={isCurrent && onHeader ? "primary" : done || onHeader ? "inverse" : "secondary"}
                  style={styles.stepDotText}
                >
                  {done && !isCurrent ? "✓" : STEP_MARKS[step]}
                </Text>
              </View>
              {hasRequiredMissing && !isCurrent ? <View style={styles.errorDot} /> : null}
            </View>
            <Text
              variant="caption"
              tone={isCurrent && !onHeader ? "primary" : onHeader ? "inverse" : "secondary"}
              style={isCurrent ? styles.bold : undefined}
              numberOfLines={1}
            >
              {STEP_TITLES[step]}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

export function SectionCard({
  title,
  progress,
  children,
}: {
  title: string
  progress?: StepProgress
  children: ReactNode
}) {
  return (
    <View style={styles.sectionStack}>
      {progress?.missing.length ? (
        <View style={styles.notice} accessibilityRole="alert">
          <View style={styles.noticeMark}>
            <Text variant="caption" tone="inverse">
              !
            </Text>
          </View>
          <View style={styles.noticeCopy}>
            <Text variant="label" style={styles.noticeTitle}>
              {SECTION_BLOCKED_MESSAGE}
            </Text>
            <Text variant="caption" style={styles.noticeBody}>
              {progress.missing.join(" · ")}
            </Text>
          </View>
        </View>
      ) : null}
      <View style={[cardStyle, styles.section]}>
        <Text variant="caption" tone="secondary" style={styles.sectionTitle}>
          {title}
        </Text>
        <View style={styles.sectionBody}>{children}</View>
      </View>
    </View>
  )
}

export function MetricTile({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: SyncChipTone }) {
  const t = TONE_STYLES[tone]
  return (
    <View style={[styles.tile, { borderLeftColor: t.fg }]}>
      <Text variant="heading">{String(value)}</Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  )
}

export function OptionChips<T extends string>({
  label,
  options,
  value,
  onChange,
  required,
  disabled,
}: {
  label: string
  options: readonly T[]
  value: T | null
  onChange: (next: T | null) => void
  required?: boolean
  disabled?: boolean
}) {
  return (
    <View style={styles.field}>
      <Text variant="label">
        {label}
        {required ? <Text tone="danger"> *</Text> : null}
      </Text>
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const selected = option === value
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(selected && !required ? null : option)}
              style={[styles.chip, selected && styles.chipSelected, disabled && styles.disabled]}
            >
              <Text variant="label" tone={selected ? "inverse" : "default"}>
                {optionLabel(option)}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function YesNoChips({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: boolean | null
  onChange: (next: boolean | null) => void
  disabled?: boolean
}) {
  const choices: { v: boolean; t: string }[] = [
    { v: true, t: "Yes" },
    { v: false, t: "No" },
  ]
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <View style={styles.chipWrap}>
        {choices.map(({ v, t }) => {
          const selected = value === v
          return (
            <Pressable
              key={t}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(selected ? null : v)}
              style={[styles.chip, selected && styles.chipSelected, disabled && styles.disabled]}
            >
              <Text variant="label" tone={selected ? "inverse" : "default"}>
                {t}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

type BoundTextProps = Omit<TextInputProps, "value" | "onChangeText"> & {
  label: string
  value: string | null
  onCommit: (text: string) => void
  error?: string
  required?: boolean
}

/**
 * Keeps the typed text locally so an in-flight save or an invalid intermediate value
 * (empty required field, partial number) never overwrites what the surveyor is typing.
 */
export function BoundTextField({ label, value, onCommit, error, required, onFocus, onBlur, ...rest }: BoundTextProps) {
  const [text, setText] = useState(value ?? "")
  const focusedRef = useRef(false)
  useEffect(() => {
    if (!focusedRef.current) setText(value ?? "")
  }, [value])
  return (
    <TextField
      {...rest}
      label={required ? `${label} *` : label}
      value={text}
      error={error}
      onFocus={(e) => {
        focusedRef.current = true
        onFocus?.(e)
      }}
      onBlur={(e) => {
        focusedRef.current = false
        onBlur?.(e)
      }}
      onChangeText={(next) => {
        setText(next)
        onCommit(next)
      }}
    />
  )
}

export function BoundNumberField({
  label,
  value,
  onCommit,
  integer,
  editable,
  required,
}: {
  label: string
  value: number | null
  onCommit: (next: number | null) => void
  integer?: boolean
  editable?: boolean
  required?: boolean
}) {
  const [error, setError] = useState<string | undefined>()
  return (
    <BoundTextField
      label={label}
      required={required}
      value={value === null ? null : String(value)}
      keyboardType={integer ? "number-pad" : "decimal-pad"}
      editable={editable}
      error={error}
      onCommit={(text) => {
        const trimmed = text.trim()
        if (trimmed === "") {
          setError(undefined)
          onCommit(null)
          return
        }
        const parsed = Number(trimmed)
        if (!Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed))) {
          setError(integer ? "Enter a whole number" : "Enter a valid number")
          return
        }
        setError(undefined)
        onCommit(parsed)
      }}
    />
  )
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  syncChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 32,
  },
  steps: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
    alignItems: "flex-start",
  },
  step: {
    alignItems: "center",
    justifyContent: "flex-start",
    gap: spacing.xs,
    width: 64,
    minHeight: touchTarget,
  },
  stepDisabled: { opacity: 0.4 },
  stepHeader: { backgroundColor: "transparent" },
  stepDot: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotHeader: { backgroundColor: "rgba(255,255,255,0.16)" },
  stepDotCurrent: { backgroundColor: colors.primary },
  stepDotCurrentHeader: { backgroundColor: colors.surface },
  stepDotDone: { backgroundColor: colors.success },
  stepDotText: { fontWeight: "700" },
  errorDot: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F59E0B",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  bold: { fontWeight: "700" },
  sectionStack: { gap: spacing.md, marginBottom: spacing.lg },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningMuted,
  },
  noticeMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warning,
  },
  noticeCopy: { flex: 1, gap: 2 },
  noticeTitle: { color: colors.warning, fontWeight: "700" },
  noticeBody: { color: colors.warning },
  section: { gap: spacing.md },
  sectionTitle: { fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  sectionBody: { gap: spacing.lg },
  tile: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  field: { gap: spacing.sm },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  disabled: { opacity: 0.5 },
})
