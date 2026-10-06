import { Text } from "@/components/ui"
import { colors, radius, spacing } from "@/theme"
import { Pressable, StyleSheet, View } from "react-native"
import { fieldBucket } from "../lib/lifecycle"
import { surveyListLabel } from "../lib/survey-list-label"
import type { SurveyRecord } from "../types"
import { Pill, StatusBadge } from "./primitives"

export function SurveyRow({
  survey,
  unsynced,
  showAssignee,
  onPress,
}: {
  survey: SurveyRecord
  unsynced?: boolean
  showAssignee?: boolean
  onPress: () => void
}) {
  const bucket = fieldBucket(survey.surveyStatus, survey.qcStatus)
  const label = surveyListLabel({
    propertyId: survey.propertyId,
    houseDoorNo: survey.houseDoorNo,
    respondentName: survey.respondentName,
    wardNumber: survey.ward?.wardNumber ?? null,
  })
  const subtitle = [label.subtitle, showAssignee ? survey.assignedTo?.fullName : null].filter(Boolean).join(" · ")
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Survey ${label.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.main}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {label.title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {subtitle}
        </Text>
        <Text variant="caption" tone="secondary">
          Updated {new Date(survey.updatedAt).toLocaleString()}
        </Text>
      </View>
      <View style={styles.side}>
        <StatusBadge bucket={bucket} />
        {unsynced ? <Pill label="Unsynced" tone="warning" /> : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  main: { flex: 1, gap: 2 },
  side: { alignItems: "flex-end", gap: spacing.xs },
})
