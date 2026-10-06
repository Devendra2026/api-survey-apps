import { Button, Text } from "@/components/ui"
import { getApiErrorMessage } from "@/services/api/client"
import { createFloor, deleteFloor, updateFloor } from "@/services/api/surveys"
import { colors, radius, spacing } from "@/theme"
import { isExcludedFromPlotAreaCheck, isOpenLandPropertyUse, sqFtToSqMeter } from "@workspace/validation"
import { useState } from "react"
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRecordCache } from "../hooks/queries"
import { isDuplicateFloor, missingFloorFields } from "../lib/floor-draft"
import { optionLabel } from "../lib/labels"
import {
  CONSTRUCTION_TYPES,
  FLOOR_POSITIONS,
  USAGE_FACTORS,
  USAGE_TYPES,
  type ConstructionType,
  type FloorPosition,
  type SurveyFloor,
  type UsageFactor,
  type UsageType,
} from "../types"
import { AreaAddButton } from "./area-add-button"
import { AreaMeasurePair } from "./area-measure-pair"
import { CatalogSelect, EnumSelect } from "./SurveySelect"

export type FloorListMode = "built-up" | "open-land"

const SECTION_COPY: Record<
  FloorListMode,
  { title: string; helper: string; empty: string; addLabel: string; sheetTitle: string }
> = {
  "built-up": {
    title: "Built-up floors",
    helper: "Ground floor, first floor, and other constructed levels. Tap a row to edit; long press to delete.",
    empty: "Tap + to add a built-up floor row.",
    addLabel: "Add built-up floor",
    sheetTitle: "floor",
  },
  "open-land": {
    title: "Open land area",
    helper: "Vacant or undeveloped plot area — kept separate from built-up floors.",
    empty: "Add an open land row if part of the plot is vacant.",
    addLabel: "Add open land row",
    sheetTitle: "open land",
  },
}

function confirmDelete(title: string, onConfirm: () => void) {
  Alert.alert(title, "This cannot be undone.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: onConfirm },
  ])
}

function floorArea(value: SurveyFloor["areaSqFt"]): number | null {
  if (value === null) return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function positionsForMode(mode: FloorListMode, current: FloorPosition | null): FloorPosition[] {
  const base: FloorPosition[] =
    mode === "built-up" ? FLOOR_POSITIONS.filter((item) => item !== "OPEN_LAND") : ["OPEN_LAND"]
  if (current !== null && !base.includes(current)) return [current, ...base]
  return base
}

function isOpenLandRow(floor: SurveyFloor): boolean {
  return isExcludedFromPlotAreaCheck(floor.floorPosition, floor.usageFactor)
}

export function FloorsEditor({
  surveyId,
  floors,
  editable,
  mode,
  propertyUse,
}: {
  surveyId: string
  floors: SurveyFloor[]
  editable: boolean
  mode: FloorListMode
  propertyUse: string | null
}) {
  const recordCache = useRecordCache()
  const insets = useSafeAreaInsets()
  const copy = SECTION_COPY[mode]
  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<FloorPosition | null>(null)
  const [usageFactor, setUsageFactor] = useState<UsageFactor | null>(null)
  const [usageType, setUsageType] = useState<UsageType | null>(null)
  const [construction, setConstruction] = useState<ConstructionType | null>(null)
  const [area, setArea] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const visible = floors.filter((floor) => (mode === "open-land" ? isOpenLandRow(floor) : !isOpenLandRow(floor)))
  const addDisabled = mode === "built-up" && isOpenLandPropertyUse(propertyUse)
  const areaSqMeter = area === null ? null : (sqFtToSqMeter(area) ?? null)

  const reset = () => {
    setOpen(false)
    setEditingId(null)
    setPosition(null)
    setUsageFactor(null)
    setUsageType(null)
    setConstruction(null)
    setArea(null)
    setError(null)
  }

  const openNew = () => {
    if (addDisabled) return
    setEditingId(null)
    setPosition(mode === "open-land" ? "OPEN_LAND" : null)
    setUsageFactor(null)
    setUsageType(null)
    setConstruction(null)
    setArea(null)
    setError(null)
    setOpen(true)
  }

  const openEdit = (floor: SurveyFloor) => {
    if (!editable) return
    setEditingId(floor.id)
    setPosition(floor.floorPosition)
    setUsageFactor(floor.usageFactor)
    setUsageType(floor.usageType)
    setConstruction(floor.constructionType)
    setArea(floorArea(floor.areaSqFt))
    setError(null)
    setOpen(true)
  }

  const missing = missingFloorFields({
    position,
    area,
    usageFactor,
    usageType,
    construction,
  })
  const duplicate =
    position !== null && usageFactor !== null && construction !== null
      ? isDuplicateFloor(floors, {
        id: editingId,
        floorPosition: position,
        usageFactor,
        constructionType: construction,
      })
      : false
  const ready = missing.length === 0 && !duplicate

  const rememberFloor = (floor: SurveyFloor) => {
    recordCache.update(surveyId, (current) => {
      const exists = current.floors.some((row) => row.id === floor.id)
      return {
        ...current,
        floors: exists ? current.floors.map((row) => (row.id === floor.id ? floor : row)) : [...current.floors, floor],
      }
    })
  }

  const save = async () => {
    if (!position || !usageFactor || !usageType || !construction || area === null || !ready) {
      setError(duplicate ? "This floor is already added." : missing.join(" "))
      return
    }
    setBusy(true)
    setError(null)
    const body = {
      floorPosition: position,
      usageFactor,
      usageType,
      constructionType: construction,
      areaSqFt: area,
    }
    try {
      if (editingId) {
        rememberFloor(await updateFloor(editingId, body))
      } else {
        rememberFloor(await createFloor({ surveyId, ...body }))
      }
      reset()
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not save floor. Check your connection and try again."))
    } finally {
      setBusy(false)
    }
  }

  const remove = (floor: SurveyFloor) =>
    confirmDelete(`Delete ${optionLabel(floor.floorPosition)}?`, () => {
      void deleteFloor(floor.id)
        .then(() => recordCache.update(surveyId, (r) => ({ ...r, floors: r.floors.filter((f) => f.id !== floor.id) })))
        .catch((e: unknown) => Alert.alert("Delete failed", getApiErrorMessage(e)))
    })

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text variant="label" tone="secondary" style={styles.sectionTitle}>
          {copy.title}
        </Text>
        {editable ? <AreaAddButton label={copy.addLabel} disabled={addDisabled} onPress={openNew} /> : null}
      </View>
      <Text variant="caption" tone="secondary">
        {copy.helper}
      </Text>
      {visible.length === 0 ? (
        <Pressable
          accessibilityRole={editable && !addDisabled ? "button" : "text"}
          accessibilityLabel={copy.addLabel}
          disabled={!editable || addDisabled}
          onPress={openNew}
          style={styles.empty}
        >
          <Text variant="caption" tone="secondary">
            {copy.empty}
          </Text>
        </Pressable>
      ) : null}
      {visible.map((floor) => {
        const sqFt = floorArea(floor.areaSqFt)
        const sqMeter = sqFt === null ? null : sqFtToSqMeter(sqFt)
        return (
          <Pressable
            key={floor.id}
            accessibilityRole={editable ? "button" : "text"}
            accessibilityLabel={`${optionLabel(floor.floorPosition)}. Tap to edit. Long press to delete.`}
            disabled={!editable}
            onPress={() => openEdit(floor)}
            onLongPress={() => remove(floor)}
            style={styles.row}
          >
            <Text variant="bodyStrong">{optionLabel(floor.floorPosition)}</Text>
            <Text variant="caption" tone="secondary">
              {optionLabel(floor.usageFactor)}
              {floor.usageType ? ` · ${optionLabel(floor.usageType)}` : ""} · {optionLabel(floor.constructionType)}
              {sqFt === null ? "" : ` · ${String(sqFt)} sq ft`}
              {sqMeter === undefined || sqMeter === null ? "" : ` · ${String(sqMeter)} sq m`}
            </Text>
          </Pressable>
        )
      })}
      {open ? (
        <Modal visible animationType="slide" transparent onRequestClose={reset}>
          <KeyboardAvoidingView style={styles.sheetHost} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <Pressable accessibilityLabel="Close floor form" style={styles.sheetDismiss} onPress={reset} />
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
              <View style={styles.handle} />
              <Text variant="heading">{editingId ? `Edit ${copy.sheetTitle}` : `Add ${copy.sheetTitle}`}</Text>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
                <EnumSelect
                  label="Floor no."
                  required
                  presentation="inline"
                  options={positionsForMode(mode, position)}
                  value={position}
                  disabled={mode === "open-land"}
                  onChange={setPosition}
                />
                <Text variant="label">
                  Floor area <Text tone="danger">*</Text>
                </Text>
                <AreaMeasurePair
                  sqFt={area}
                  sqMeter={areaSqMeter}
                  editable
                  onCommit={(pair) => setArea(pair.sqFt)}
                />
                <CatalogSelect
                  category="USAGE_FACTOR"
                  allowed={USAGE_FACTORS}
                  label="Usage factor"
                  required
                  presentation="inline"
                  value={usageFactor}
                  onChange={setUsageFactor}
                />
                <CatalogSelect
                  category="USAGE_TYPE"
                  allowed={USAGE_TYPES}
                  label="Usage type"
                  required
                  presentation="inline"
                  value={usageType}
                  onChange={setUsageType}
                />
                <CatalogSelect
                  category="CONSTRUCTION_TYPE"
                  allowed={CONSTRUCTION_TYPES}
                  label="Construction type"
                  required
                  presentation="inline"
                  value={construction}
                  onChange={setConstruction}
                />
                {duplicate ? (
                  <Text variant="caption" tone="danger">
                    This floor is already added.
                  </Text>
                ) : null}
                {missing.length > 0 ? (
                  <View>
                    {missing.map((message) => (
                      <Text key={message} variant="caption" tone="danger">
                        {message}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {error ? (
                  <Text variant="caption" tone="danger">
                    {error}
                  </Text>
                ) : null}
              </ScrollView>
              <View style={styles.actions}>
                <Button title="Cancel" variant="secondary" onPress={reset} style={styles.flex} />
                <Button
                  title={editingId ? "Save floor" : "Add"}
                  loading={busy}
                  disabled={!ready || busy}
                  onPress={() => void save()}
                  style={styles.flex}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    zIndex: 2,
  },
  sectionTitle: { flex: 1, letterSpacing: 0.4, textTransform: "uppercase" },
  empty: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  row: {
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  sheetHost: { flex: 1, justifyContent: "flex-end" },
  sheetDismiss: { flex: 1 },
  sheet: {
    maxHeight: "88%",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  sheetBody: { gap: spacing.lg, paddingBottom: spacing.lg },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  actions: { flexDirection: "row", gap: spacing.md },
  flex: { flex: 1 },
})
