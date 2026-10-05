import { Text } from "@/components/ui"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { stepOrdinal } from "../lib/navigation"
import { STEP_CHIP_LABELS, STEP_IDS, STEP_MARKS, type StepId } from "../lib/requirements"
import { SurveySelect } from "./SurveySelect"
import { SURVEY_HEADER, type StartSurveyViewProps } from "./start-survey-model"

function StepMark({
  step,
  selected,
  onSelect,
}: {
  step: StepId
  selected: boolean
  onSelect: (step: StepId) => void
}) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onSelect(step)} style={styles.mark}>
      <View style={[styles.circle, selected ? styles.circleOn : styles.circleOff]}>
        <Text variant="label" style={{ color: selected ? SURVEY_HEADER : "#FFFFFF" }}>
          {STEP_MARKS[step]}
        </Text>
      </View>
      <Text variant="caption" style={{ color: "#FFFFFF", fontWeight: selected ? "700" : "400" }}>
        {STEP_CHIP_LABELS[step]}
      </Text>
    </Pressable>
  )
}

/** iOS and web twin of the Jetpack Compose survey start screen. */
export function StartSurveyView(props: StartSurveyViewProps) {
  const insets = useSafeAreaInsets()
  const ordinal = stepOrdinal("start")
  const subtitle = `${ordinal.label} · Start · ${props.completionPercent}% · Jump to any step`
  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text variant="caption" style={styles.headerMuted}>
          New survey
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={props.onBack} style={styles.back}>
          <Text variant="heading" style={styles.headerTitle}>
            ‹  Survey start
          </Text>
        </Pressable>
        <Text variant="caption" style={styles.headerMuted}>
          {subtitle}
        </Text>
        <View accessibilityRole="progressbar" style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, props.completionPercent))}%` }]} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
          {STEP_IDS.map((step) => (
            <StepMark key={step} step={step} selected={step === props.currentStep} onSelect={props.onSelectStep} />
          ))}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={props.onNewSurvey} style={styles.newLink}>
          <Text variant="label" style={{ color: SURVEY_HEADER }}>
            + New survey
          </Text>
        </Pressable>
        <Text variant="caption" style={styles.section}>
          ASSESSMENT
        </Text>
        <SurveySelect
          label="Assessment year"
          value={props.yearValue || null}
          options={props.yearOptions}
          disabled={!props.editable}
          onChange={(value) => {
            if (value) props.onYear(value)
          }}
        />
        <Text variant="caption" style={styles.section}>
          LOCATION (TENANT)
        </Text>
        <SurveySelect
          label="District"
          value={props.districtValue || null}
          options={props.districtOptions}
          disabled={!props.editable}
          onChange={(value) => {
            if (value) props.onDistrict(value)
          }}
        />
        <SurveySelect
          label="ULB"
          value={props.ulbValue || null}
          options={props.ulbOptions}
          disabled={!props.editable || props.districtValue.length === 0}
          onChange={(value) => {
            if (value) props.onUlb(value)
          }}
        />
        <SurveySelect
          label="PIN"
          value={props.pinValue || null}
          options={props.pinOptions}
          disabled={!props.editable || props.ulbValue.length === 0}
          onChange={(value) => {
            if (value) props.onPin(value)
          }}
        />
        {props.showScope ? (
          <View style={styles.scope}>
            <Text variant="caption" tone="secondary">
              Selected scope
            </Text>
            <Text variant="heading">{props.scopeTitle}</Text>
            <Text variant="body">{props.scopeLine}</Text>
            <Text variant="caption" tone="secondary">
              Ward is selected on the next step.
            </Text>
          </View>
        ) : null}
        {props.error ? (
          <Text variant="caption" tone="danger">
            {props.error}
          </Text>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={!props.canContinue || props.saving}
          onPress={props.onSaveDraft}
          style={[styles.outline, (!props.canContinue || props.saving) && styles.disabled]}
        >
          <Text variant="bodyStrong" style={{ color: SURVEY_HEADER }}>
            {props.saving ? "Saving…" : "Save draft"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!props.canContinue || props.saving}
          onPress={props.onNext}
          style={[styles.filled, (!props.canContinue || props.saving) && styles.disabled]}
        >
          <Text variant="bodyStrong" style={{ color: "#FFFFFF" }}>
            Next: Property
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { backgroundColor: SURVEY_HEADER, paddingHorizontal: 16, paddingBottom: 12, gap: 4 },
  headerMuted: { color: "rgba(255,255,255,0.88)" },
  headerTitle: { color: "#FFFFFF" },
  back: { minHeight: 44, justifyContent: "center" },
  track: { height: 4, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.28)", overflow: "hidden", marginTop: 8 },
  fill: { height: "100%", backgroundColor: "#FFFFFF" },
  rail: { gap: 4, paddingTop: 10 },
  mark: { alignItems: "center", width: 72, gap: 4 },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  circleOn: { backgroundColor: "#FFFFFF" },
  circleOff: { backgroundColor: "rgba(255,255,255,0.22)" },
  body: { padding: 16, gap: 12, paddingBottom: 24 },
  newLink: { alignSelf: "flex-end", minHeight: 44, justifyContent: "center" },
  section: { color: "#64748B", fontWeight: "700", letterSpacing: 0.6 },
  scope: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, gap: 4, borderWidth: 1, borderColor: "#E2E8F0" },
  footer: { flexDirection: "row", gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  outline: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SURVEY_HEADER,
    alignItems: "center",
    justifyContent: "center",
  },
  filled: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: SURVEY_HEADER, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.45 },
})
