import { Text, TextField } from "@/components/ui"
import { spacing } from "@/theme"
import { StyleSheet, View } from "react-native"
import { optionLabel } from "../lib/labels"
import type { AssessmentYear } from "../types"

type Props = {
  year: AssessmentYear
}

/** Assessment year chosen when the survey was created. Later steps cannot change it. */
export function AssessmentYearField({ year }: Props) {
  return (
    <View style={styles.stack}>
      <TextField label="Assessment year" value={optionLabel(year)} editable={false} />
      <Text variant="caption" tone="secondary">
        Set when the survey was started.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
})
