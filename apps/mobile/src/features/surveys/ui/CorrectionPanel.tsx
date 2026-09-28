import { Button, Text } from "@/components/ui"
import { colors, radius, spacing } from "@/theme"
import { Pressable, StyleSheet, View } from "react-native"
import { STEP_TITLES, stepForRemarkSection } from "../lib/requirements"
import type { SurveyRecord } from "../types"

/**
 * QC feedback for a returned survey. Corrections always happen on the same survey id:
 * REJECTED → `POST /surveys/:id/reopen` (REOPENED) → edit → `POST /surveys/:id/submit`.
 */
export function CorrectionPanel({
  record,
  canReopen,
  reopening,
  onReopen,
  onGoTo,
}: {
  record: SurveyRecord
  canReopen: boolean
  reopening: boolean
  onReopen: () => void
  onGoTo: (section: string | null, body: string) => void
}) {
  const open = (record.qcRemarkThread ?? []).filter((r) => !r.resolvedAt)
  const summary = record.qcRemarks?.trim()

  return (
    <View style={styles.wrap}>
      <Text variant="heading" tone="danger">
        Changes requested by QC
      </Text>
      {record.rejectedAt ? (
        <Text variant="caption" tone="secondary">
          Returned {new Date(record.rejectedAt).toLocaleString()}
        </Text>
      ) : null}
      {summary && !open.some((r) => r.body === summary) ? <Text variant="body">{summary}</Text> : null}
      {open.map((remark) => {
        const step = stepForRemarkSection(remark.section, remark.body)
        const parts = [remark.field, remark.reason].filter((p): p is string => Boolean(p))
        const showBody = remark.body !== parts.join(": ")
        return (
          <Pressable
            key={remark.id}
            accessibilityRole={step ? "link" : "text"}
            disabled={!step}
            onPress={() => onGoTo(remark.section, remark.body)}
            style={styles.remark}
          >
            <View style={styles.flex}>
              {parts.length ? <Text variant="label">{parts.join(" — ")}</Text> : null}
              {showBody ? <Text variant="body">{remark.body}</Text> : null}
              {remark.author ? (
                <Text variant="caption" tone="secondary">
                  {remark.author.fullName}
                </Text>
              ) : null}
            </View>
            {step ? (
              <Text variant="caption" tone="primary">
                {STEP_TITLES[step]} ›
              </Text>
            ) : null}
          </Pressable>
        )
      })}
      {canReopen ? (
        <Button title="Start correction" loading={reopening} onPress={onReopen} />
      ) : (
        <Text variant="caption" tone="secondary">
          Fix the items above, then resubmit from the Photos step. The same survey is sent back to QC.
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerMuted,
  },
  remark: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  flex: { flex: 1, gap: 2 },
})
