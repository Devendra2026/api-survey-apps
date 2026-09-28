import { Text, TextField, cardStyle } from "@/components/ui"
import { colors, radius, spacing } from "@/theme"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type TextInputProps } from "react-native"
import { optionLabel } from "../lib/labels"
import { FIELD_BUCKET_LABELS, type FieldBucket } from "../lib/lifecycle"
import { STEP_TITLES, type StepId, type StepProgress } from "../lib/requirements"
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
}: {
  steps: readonly StepId[]
  current: StepId
  progress: Record<StepId, StepProgress>
  onSelect: (step: StepId) => void
}) {
  const scrollRef = useRef<ScrollView>(null)
  const index = steps.indexOf(current)
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: Math.max(0, index - 1) * 104, animated: true })
  }, [index])

  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.steps}>
      {steps.map((step, i) => {
        const p = progress[step]
        const isCurrent = step === current
        const blocked = p.missing.length > 0
        const done = !blocked && p.filled > 0
        return (
          <Pressable
            key={step}
            accessibilityRole="tab"
            accessibilityState={{ selected: isCurrent }}
            accessibilityLabel={`${STEP_TITLES[step]}${blocked ? ", required fields missing" : done ? ", done" : ""}`}
            onPress={() => onSelect(step)}
            style={[styles.step, isCurrent && styles.stepCurrent]}
          >
            <View style={[styles.stepDot, done && styles.stepDotDone, blocked && styles.stepDotBlocked]}>
              <Text variant="caption" tone={done || blocked ? "inverse" : "secondary"} style={styles.stepDotText}>
                {done ? "✓" : blocked ? "!" : String(i + 1)}
              </Text>
            </View>
            <Text variant="caption" tone={isCurrent ? "primary" : "secondary"} style={isCurrent && styles.bold}>
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
    <View style={[cardStyle, styles.section]}>
      <View style={styles.sectionHeader}>
        <Text variant="heading">{title}</Text>
        {progress ? (
          <Text variant="caption" tone="secondary">
            {progress.filled}/{progress.total} filled
          </Text>
        ) : null}
      </View>
      {progress?.missing.length ? (
        <View style={styles.missingBox}>
          {progress.missing.map((m) => (
            <Text key={m} variant="caption" tone="danger">
              • {m}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={styles.sectionBody}>{children}</View>
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
}: {
  label: string
  value: number | null
  onCommit: (next: number | null) => void
  integer?: boolean
  editable?: boolean
}) {
  const [error, setError] = useState<string | undefined>()
  return (
    <BoundTextField
      label={label}
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
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  step: {
    alignItems: "center",
    gap: spacing.xs,
    width: 96,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stepCurrent: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotDone: { backgroundColor: colors.success },
  stepDotBlocked: { backgroundColor: colors.danger },
  stepDotText: { fontWeight: "700" },
  bold: { fontWeight: "700" },
  section: { gap: spacing.md, marginBottom: spacing.lg },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionBody: { gap: spacing.lg },
  missingBox: {
    backgroundColor: colors.dangerMuted,
    borderRadius: radius.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
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
