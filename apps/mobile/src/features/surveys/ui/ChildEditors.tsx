import { Button, Text } from "@/components/ui"
import { getApiErrorMessage } from "@/services/api/client"
import { createCoOwner, createFloor, deleteCoOwner, deleteFloor } from "@/services/api/surveys"
import { colors, radius, spacing } from "@/theme"
import { useState } from "react"
import { Alert, StyleSheet, View } from "react-native"
import { useRecordCache } from "../hooks/queries"
import { optionLabel } from "../lib/labels"
import {
  CONSTRUCTION_TYPES,
  FLOOR_POSITIONS,
  USAGE_FACTORS,
  USAGE_TYPES,
  type ConstructionType,
  type FloorPosition,
  type SurveyCoOwner,
  type SurveyFloor,
  type UsageFactor,
  type UsageType,
} from "../types"
import { BoundNumberField, BoundTextField, OptionChips } from "./primitives"

function confirmDelete(title: string, onConfirm: () => void) {
  Alert.alert(title, "This cannot be undone.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: onConfirm },
  ])
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
  const [adding, setAdding] = useState(false)
  const [position, setPosition] = useState<FloorPosition | null>(null)
  const [usageFactor, setUsageFactor] = useState<UsageFactor | null>(null)
  const [usageType, setUsageType] = useState<UsageType | null>(null)
  const [construction, setConstruction] = useState<ConstructionType | null>(null)
  const [area, setArea] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setAdding(false)
    setPosition(null)
    setUsageFactor(null)
    setUsageType(null)
    setConstruction(null)
    setArea(null)
    setError(null)
  }

  const save = async () => {
    if (!position || !usageFactor || !construction) {
      setError("Floor position, usage and construction type are required")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const floor = await createFloor({
        surveyId,
        floorPosition: position,
        usageFactor,
        constructionType: construction,
        ...(usageType ? { usageType } : {}),
        ...(area !== null ? { areaSqFt: area } : {}),
      })
      recordCache.update(surveyId, (r) => ({ ...r, floors: [...r.floors, floor] }))
      reset()
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not add floor. Check your connection and try again."))
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
      <Text variant="label">Floors *</Text>
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
          {editable ? <Button title="Delete" variant="ghost" onPress={() => remove(floor)} /> : null}
        </View>
      ))}
      {editable && adding ? (
        <View style={styles.form}>
          <OptionChips label="Floor" options={FLOOR_POSITIONS} value={position} onChange={setPosition} required />
          <OptionChips label="Usage" options={USAGE_FACTORS} value={usageFactor} onChange={setUsageFactor} required />
          <OptionChips label="Occupancy" options={USAGE_TYPES} value={usageType} onChange={setUsageType} />
          <OptionChips
            label="Construction"
            options={CONSTRUCTION_TYPES}
            value={construction}
            onChange={setConstruction}
            required
          />
          <BoundNumberField label="Area (sq ft)" value={area} onCommit={setArea} />
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button title="Cancel" variant="secondary" onPress={reset} style={styles.flex} />
            <Button title="Save floor" loading={busy} onPress={() => void save()} style={styles.flex} />
          </View>
        </View>
      ) : null}
      {editable && !adding ? <Button title="+ Add floor" variant="secondary" onPress={() => setAdding(true)} /> : null}
    </View>
  )
}

export function CoOwnersEditor({
  surveyId,
  coOwners,
  editable,
  required,
}: {
  surveyId: string
  coOwners: SurveyCoOwner[]
  editable: boolean
  required: boolean
}) {
  const recordCache = useRecordCache()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [relation, setRelation] = useState("")
  const [mobile, setMobile] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setAdding(false)
    setName("")
    setRelation("")
    setMobile("")
    setError(null)
  }

  const save = async () => {
    if (!name.trim()) {
      setError("Co-owner name is required")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const row = await createCoOwner({
        surveyId,
        name: name.trim(),
        ...(relation.trim() ? { fatherOrHusbandName: relation.trim() } : {}),
        ...(mobile.trim() ? { mobile: mobile.trim() } : {}),
      })
      recordCache.update(surveyId, (r) => ({ ...r, coOwners: [...r.coOwners, row] }))
      reset()
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not add co-owner. Check your connection and try again."))
    } finally {
      setBusy(false)
    }
  }

  const remove = (row: SurveyCoOwner) =>
    confirmDelete(`Remove ${row.name}?`, () => {
      void deleteCoOwner(row.id)
        .then(() =>
          recordCache.update(surveyId, (r) => ({ ...r, coOwners: r.coOwners.filter((c) => c.id !== row.id) })),
        )
        .catch((e: unknown) => Alert.alert("Delete failed", getApiErrorMessage(e)))
    })

  return (
    <View style={styles.wrap}>
      <Text variant="label">Co-owners{required ? " *" : ""}</Text>
      {coOwners.length === 0 ? (
        <Text variant="caption" tone={required ? "danger" : "secondary"}>
          {required ? "Joint ownership needs at least one co-owner." : "No co-owners added."}
        </Text>
      ) : null}
      {coOwners.map((row) => (
        <View key={row.id} style={styles.row}>
          <View style={styles.rowText}>
            <Text variant="bodyStrong">{row.name}</Text>
            {row.fatherOrHusbandName || row.mobile ? (
              <Text variant="caption" tone="secondary">
                {[row.fatherOrHusbandName, row.mobile].filter(Boolean).join(" · ")}
              </Text>
            ) : null}
          </View>
          {editable ? <Button title="Remove" variant="ghost" onPress={() => remove(row)} /> : null}
        </View>
      ))}
      {editable && adding ? (
        <View style={styles.form}>
          <BoundTextField label="Name" required value={name} onCommit={setName} autoCapitalize="words" />
          <BoundTextField label="Father / Husband name" value={relation} onCommit={setRelation} autoCapitalize="words" />
          <BoundTextField label="Mobile" value={mobile} onCommit={setMobile} keyboardType="phone-pad" maxLength={15} />
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button title="Cancel" variant="secondary" onPress={reset} style={styles.flex} />
            <Button title="Save co-owner" loading={busy} onPress={() => void save()} style={styles.flex} />
          </View>
        </View>
      ) : null}
      {editable && !adding ? <Button title="+ Add co-owner" variant="secondary" onPress={() => setAdding(true)} /> : null}
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
  form: {
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actions: { flexDirection: "row", gap: spacing.md },
  flex: { flex: 1 },
})
