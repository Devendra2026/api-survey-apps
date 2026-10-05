import {
  Button,
  Column,
  DropdownMenuItem,
  ExposedDropdownMenu,
  ExposedDropdownMenuBox,
  Host,
  LazyColumn,
  LazyRow,
  LinearProgressIndicator,
  OutlinedButton,
  OutlinedCard,
  OutlinedTextField,
  Row,
  Text,
  useNativeState,
} from "@expo/ui/jetpack-compose"
import {
  background,
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  menuAnchor,
  padding,
  paddingAll,
  Shapes,
  size,
  weight,
} from "@expo/ui/jetpack-compose/modifiers"
import { useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { stepOrdinal } from "../lib/navigation"
import { STEP_CHIP_LABELS, STEP_IDS, STEP_MARKS, type StepId } from "../lib/requirements"
import { SURVEY_HEADER, type StartOption, type StartSurveyViewProps } from "./start-survey-model"

function ComposeDropdown({
  label,
  valueLabel,
  options,
  enabled,
  onSelect,
}: {
  label: string
  valueLabel: string
  options: readonly StartOption[]
  enabled: boolean
  onSelect: (value: string) => void
}) {
  const text = useNativeState(valueLabel)
  const [expanded, setExpanded] = useState(false)
  return (
    <ExposedDropdownMenuBox
      expanded={expanded}
      onExpandedChange={(open) => {
        if (enabled) setExpanded(open)
      }}
      modifiers={[fillMaxWidth()]}
    >
      <OutlinedTextField value={text} readOnly enabled={enabled} singleLine modifiers={[menuAnchor(), fillMaxWidth()]}>
        <OutlinedTextField.Label>
          <Text>{label}</Text>
        </OutlinedTextField.Label>
      </OutlinedTextField>
      <ExposedDropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => {
              onSelect(option.value)
              setExpanded(false)
            }}
          >
            <DropdownMenuItem.Text>
              <Text>{option.label}</Text>
            </DropdownMenuItem.Text>
          </DropdownMenuItem>
        ))}
      </ExposedDropdownMenu>
    </ExposedDropdownMenuBox>
  )
}

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
    <Column
      horizontalAlignment="center"
      modifiers={[clickable(() => onSelect(step)), padding(6, 0, 6, 0)]}
    >
      <Column
        horizontalAlignment="center"
        verticalArrangement="center"
        modifiers={[
          size(40, 40),
          clip(Shapes.Circle),
          background(selected ? "#FFFFFF" : "rgba(255,255,255,0.22)"),
        ]}
      >
        <Text color={selected ? SURVEY_HEADER : "#FFFFFF"} style={{ fontSize: 14, fontWeight: "700" }}>
          {STEP_MARKS[step]}
        </Text>
      </Column>
      <Text color="#FFFFFF" style={{ fontSize: 11, fontWeight: selected ? "700" : "400" }}>
        {STEP_CHIP_LABELS[step]}
      </Text>
    </Column>
  )
}

/** Android survey start screen built with Jetpack Compose. */
export function StartSurveyView(props: StartSurveyViewProps) {
  const insets = useSafeAreaInsets()
  const ordinal = stepOrdinal("start")
  const subtitle = `${ordinal.label} · Start · ${props.completionPercent}% · Jump to any step`
  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF", paddingBottom: insets.bottom }}>
      <Host style={{ flex: 1 }} colorScheme="light" seedColor={SURVEY_HEADER}>
        <Column modifiers={[fillMaxSize()]}>
          <Column modifiers={[background(SURVEY_HEADER), padding(16, insets.top + 8, 16, 12), fillMaxWidth()]}>
            <Text color="rgba(255,255,255,0.8)" style={{ fontSize: 13 }}>
              New survey
            </Text>
            <Row verticalAlignment="center">
              <Text
                color="#FFFFFF"
                style={{ fontSize: 22, fontWeight: "700" }}
                modifiers={[clickable(props.onBack), padding(0, 8, 12, 8)]}
              >
                {"‹  Survey start"}
              </Text>
            </Row>
            <Text color="rgba(255,255,255,0.9)" style={{ fontSize: 13 }}>
              {subtitle}
            </Text>
            <LinearProgressIndicator
              progress={props.completionPercent / 100}
              color="#FFFFFF"
              trackColor="rgba(255,255,255,0.28)"
              modifiers={[fillMaxWidth(), padding(0, 10, 0, 8)]}
            />
            <LazyRow horizontalArrangement={{ spacedBy: 4 }}>
              {STEP_IDS.map((step) => (
                <StepMark key={step} step={step} selected={step === props.currentStep} onSelect={props.onSelectStep} />
              ))}
            </LazyRow>
          </Column>
          <LazyColumn modifiers={[weight(1), fillMaxWidth(), background("#F7F9FC")]} contentPadding={{ start: 16, end: 16, top: 8, bottom: 16 }}>
            <Row horizontalArrangement="end" modifiers={[fillMaxWidth(), padding(0, 4, 0, 8)]}>
              <Text color={SURVEY_HEADER} style={{ fontWeight: "700" }} modifiers={[clickable(props.onNewSurvey)]}>
                + New survey
              </Text>
            </Row>
            <Text color="#64748B" style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.6 }}>
              ASSESSMENT
            </Text>
            <ComposeDropdown
              key={props.yearValue}
              label="Assessment year"
              valueLabel={props.yearLabel}
              options={props.yearOptions}
              enabled={props.editable}
              onSelect={props.onYear}
            />
            <Text color="#64748B" style={{ fontSize: 12, fontWeight: "700", letterSpacing: 0.6 }} modifiers={[padding(0, 16, 0, 0)]}>
              LOCATION (TENANT)
            </Text>
            <Column verticalArrangement={{ spacedBy: 10 }} modifiers={[fillMaxWidth(), padding(0, 8, 0, 0)]}>
              <ComposeDropdown
                key={props.districtValue || "district"}
                label="District"
                valueLabel={props.districtLabel}
                options={props.districtOptions}
                enabled={props.editable}
                onSelect={props.onDistrict}
              />
              <ComposeDropdown
                key={props.ulbValue || "ulb"}
                label="ULB"
                valueLabel={props.ulbLabel}
                options={props.ulbOptions}
                enabled={props.editable && props.districtValue.length > 0}
                onSelect={props.onUlb}
              />
              <ComposeDropdown
                key={props.pinValue || "pin"}
                label="PIN"
                valueLabel={props.pinLabel}
                options={props.pinOptions}
                enabled={props.editable && props.ulbValue.length > 0}
                onSelect={props.onPin}
              />
            </Column>
            {props.showScope ? (
              <OutlinedCard modifiers={[fillMaxWidth(), padding(0, 16, 0, 0)]}>
                <Column modifiers={[paddingAll(16), fillMaxWidth()]}>
                  <Text color="#64748B" style={{ fontSize: 12 }}>
                    Selected scope
                  </Text>
                  <Text color="#0F172A" style={{ fontSize: 18, fontWeight: "700" }}>
                    {props.scopeTitle}
                  </Text>
                  <Text color="#334155" style={{ fontSize: 14 }}>
                    {props.scopeLine}
                  </Text>
                  <Text color="#64748B" style={{ fontSize: 13 }}>
                    Ward is selected on the next step.
                  </Text>
                </Column>
              </OutlinedCard>
            ) : null}
            {props.error ? (
              <Text color="#DC2626" style={{ fontSize: 13 }} modifiers={[padding(0, 12, 0, 0)]}>
                {props.error}
              </Text>
            ) : null}
          </LazyColumn>
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 12 }}
            modifiers={[fillMaxWidth(), background("#FFFFFF"), paddingAll(16)]}
          >
            <OutlinedButton enabled={props.canContinue && !props.saving} onClick={props.onSaveDraft} modifiers={[weight(1)]}>
              <Text>{props.saving ? "Saving…" : "Save draft"}</Text>
            </OutlinedButton>
            <Button enabled={props.canContinue && !props.saving} onClick={props.onNext} modifiers={[weight(1)]}>
              <Text color="#FFFFFF">Next: Property</Text>
            </Button>
          </Row>
        </Column>
      </Host>
    </View>
  )
}
