import { Button, Text, cardStyle } from "@/components/ui"
import { spacing } from "@/theme"
import { isOpenLandPropertyUse, sqFtToSqMeter } from "@workspace/validation"
import { useEffect, type ReactNode } from "react"
import { StyleSheet, View } from "react-native"
import {
  areaMeasurePatch,
  areaMeasurePatchFromPair,
  measureNumber,
  plinthSqFtFromFloors,
  sameArea,
  summarizeAreas,
} from "../lib/area-summary"
import type { StepProgress } from "../lib/requirements"
import { STEP_TITLES } from "../lib/requirements"
import type { SurveyEditableFields, SurveyPatch, SurveyRecord } from "../types"
import { FloorsEditor } from "./ChildEditors"
import { AreaMeasurePair } from "./area-measure-pair"
import { SectionCard } from "./primitives"

type Props = {
  record: SurveyRecord
  fields: SurveyEditableFields
  progress: StepProgress
  editable: boolean
  setFields: (patch: SurveyPatch, options?: { immediate?: boolean }) => void
}

function shownMeasure(sqFt: number, show: boolean): { sqFt: number | null; sqMeter: number | null } {
  if (!show) return { sqFt: null, sqMeter: null }
  return { sqFt, sqMeter: sqFtToSqMeter(sqFt) ?? null }
}

/**
 * Area step. Plot converts between units. Plinth follows the ground-floor rows.
 * Built-up and open land stay separate lists over the same floor table.
 */
export function AreaStep({ record, fields, progress, editable, setFields }: Props) {
  const areas = summarizeAreas(fields.propertyUse, record.floors)
  const plotSqFt = measureNumber(fields.plotAreaSqFt)
  const plinthSqFt = plinthSqFtFromFloors(record.floors)
  const storedPlinth = measureNumber(fields.plinthAreaSqFt)
  const plotMeters = plotSqFt === null ? null : (sqFtToSqMeter(plotSqFt) ?? null)
  const plinthMeters = plinthSqFt === null ? null : (sqFtToSqMeter(plinthSqFt) ?? null)
  const builtUp = shownMeasure(
    areas.builtUpSqFt,
    areas.builtUpFloorCount > 0 || isOpenLandPropertyUse(fields.propertyUse)
  )
  const openLand = shownMeasure(areas.openLandSqFt, areas.openLandFloorCount > 0)
  useEffect(() => {
    if (!editable) return
    if (sameArea(plinthSqFt, storedPlinth)) return
    setFields(areaMeasurePatch("plinth", plinthSqFt))
  }, [editable, plinthSqFt, setFields, storedPlinth])
  return (
    <SectionCard title={STEP_TITLES.area} progress={progress}>
      {editable ? (
        <View style={styles.resetRow}>
          <Button
            title="Reset"
            variant="secondary"
            accessibilityLabel="Reset plot area"
            onPress={() => setFields(areaMeasurePatch("plot", null))}
          />
        </View>
      ) : null}
      <SectionTitle>Plot area</SectionTitle>
      <MeasureCard title="Plot Area" required helper="Total plot size on ground">
        <AreaMeasurePair
          sqFt={plotSqFt}
          sqMeter={plotMeters}
          editable={editable}
          onCommit={(pair) => setFields(areaMeasurePatchFromPair("plot", pair))}
        />
      </MeasureCard>
      <SectionTitle>Plinth area</SectionTitle>
      <MeasureCard
        title="Plinth Area"
        helper={plinthSqFt === null ? "Add a ground floor row to set plinth area" : "Taken from the ground floor row."}
      >
        <AreaMeasurePair sqFt={plinthSqFt} sqMeter={plinthMeters} editable={false} />
      </MeasureCard>
      <FloorsEditor
        surveyId={record.id}
        floors={record.floors}
        editable={editable}
        mode="built-up"
        propertyUse={fields.propertyUse}
      />
      <SectionTitle>Total built-up area</SectionTitle>
      <MeasureCard title="Total Built-up Area" helper="Sum of built-up floor rows only (excludes open land)">
        <AreaMeasurePair sqFt={builtUp.sqFt} sqMeter={builtUp.sqMeter} editable={false} />
      </MeasureCard>
      <FloorsEditor
        surveyId={record.id}
        floors={record.floors}
        editable={editable}
        mode="open-land"
        propertyUse={fields.propertyUse}
      />
      <SectionTitle>Total open land area</SectionTitle>
      <MeasureCard title="Total Open Land Area" helper="Sum of open land rows only">
        <AreaMeasurePair sqFt={openLand.sqFt} sqMeter={openLand.sqMeter} editable={false} />
      </MeasureCard>
    </SectionCard>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text variant="label" tone="secondary" style={styles.sectionTitle}>
      {children}
    </Text>
  )
}

function MeasureCard({
  title,
  required = false,
  helper,
  children,
}: {
  title: string
  required?: boolean
  helper: string
  children: ReactNode
}) {
  return (
    <View style={[cardStyle, styles.card]}>
      <Text variant="bodyStrong">
        {title}
        {required ? <Text tone="danger"> *</Text> : null}
      </Text>
      {children}
      <Text variant="caption" tone="secondary">
        {helper}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  resetRow: { alignItems: "flex-end" },
  sectionTitle: { letterSpacing: 0.4, textTransform: "uppercase" },
  card: { gap: spacing.sm },
})
