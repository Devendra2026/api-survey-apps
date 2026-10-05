import { Button, Text } from "@/components/ui"
import { getApiErrorMessage } from "@/services/api/client"
import { createFloor, deleteFloor, updateFloor } from "@/services/api/surveys"
import { colors, radius, spacing } from "@/theme"
import { sqFtToSqMeter } from "@workspace/validation"
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
import { BoundNumberField } from "./primitives"
import { CatalogSelect, EnumSelect } from "./SurveySelect"

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

export function FloorsEditor({
  surveyId,
  floors,
  editable,
}: {
  surveyId: string
  floors: SurveyFloor[]
  editable: boolean
}) {
  const recordCache = useRecordCache()
  const insets = useSafeAreaInsets()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<FloorPosition | null>(null)
  const [usageFactor, setUsageFactor] = useState<UsageFactor | null>(null)
  const [usageType, setUsageType] = useState<UsageType | null>(null)
  const [construction, setConstruction] = useState<ConstructionType | null>(null)
  const [area, setArea] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setEditingId(null)
    setPosition(null)
    setUsageFactor(null)
    setUsageType(null)
    setConstruction(null)
    setArea(null)
    setError(null)
    setOpen(true)
  }

  const openEdit = (floor: SurveyFloor) => {
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
  const areaSqMeter = area === null ? null : sqFtToSqMeter(area)

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
      <Text variant="label">Built-up floors *</Text>
      {floors.length === 0 ? (
        <Text variant="caption" tone="secondary">
          No floors yet. At least one floor is required to submit.
        </Text>
      ) : null}
      {floors.map((floor) => (
        <View key={floor.id} style={styles.row}>
          <View style={styles.rowText}>
            <Text variant="bodyStrong">{optionLabel(floor.floorPosition)}</Text>
            <Text variant="caption" tone="secondary">
              {optionLabel(floor.usageFactor)}
              {floor.usageType ? ` · ${optionLabel(floor.usageType)}` : ""} · {optionLabel(floor.constructionType)}
              {floor.areaSqFt !== null ? ` · ${String(floor.areaSqFt)} sq ft` : ""}
            </Text>
          </View>
          {editable ? (
            <View style={styles.actions}>
              <Button title="Edit" variant="ghost" onPress={() => openEdit(floor)} />
              <Button title="Delete" variant="ghost" onPress={() => remove(floor)} />
            </View>
          ) : null}
        </View>
      ))}
      {editable ? (
        <Button
          title="+ Add floor"
          variant="secondary"
          accessibilityLabel="Add built-up floor"
          onPress={openNew}
        />
      ) : null}
      <Modal visible={open} animationType="slide" transparent onRequestClose={reset}>
        <KeyboardAvoidingView
          style={styles.sheetHost}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable accessibilityLabel="Close floor form" style={styles.sheetDismiss} onPress={reset} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.handle} />
            <Text variant="heading">{editingId ? "Edit floor" : "Add floor"}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
              <EnumSelect
                label="Floor no."
                required
                presentation="inline"
                options={FLOOR_POSITIONS}
                value={position}
                onChange={setPosition}
              />
              <BoundNumberField label="Floor area (sq ft)" required value={area} onCommit={setArea} />
              {areaSqMeter !== null && areaSqMeter !== undefined ? (
                <Text variant="caption" tone="secondary">
                  {String(areaSqMeter)} sq m
                </Text>
              ) : null}
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
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  rowText: { flex: 1, gap: 2 },
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
