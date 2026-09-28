import { Button, Screen, StatusView, Text, TextField, cardStyle } from "@/components/ui"
import { getApiErrorMessage } from "@/services/api/client"
import { createSurvey } from "@/services/api/surveys"
import { colors, radius, spacing } from "@/theme"
import type { AuthenticatedProfile } from "@/types/user"
import { randomUUID } from "expo-crypto"
import { useRouter } from "expo-router"
import { useMemo, useRef, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native"
import { useInvalidateSurveyLists, useUlbWards } from "../hooks/queries"
import { surveyAssignments, temporaryPropertyId, type SurveyAssignment } from "../lib/assignments"
import { defaultAssessmentYear } from "../lib/labels"
import { ASSESSMENT_YEARS, type AssessmentYear } from "../types"
import { OptionChips } from "../ui/primitives"

type WardChoice = { wardId: string; label: string }

export function NewSurveyScreen({ profile }: { profile: AuthenticatedProfile }) {
  const router = useRouter()
  const invalidateLists = useInvalidateSurveyLists()
  const assignments = useMemo(() => surveyAssignments(profile), [profile])
  const [assignment, setAssignment] = useState<SurveyAssignment | null>(assignments.length === 1 ? assignments[0]! : null)
  const [ward, setWard] = useState<WardChoice | null>(null)
  const [propertyId, setPropertyId] = useState("")
  const [year, setYear] = useState<AssessmentYear>(defaultAssessmentYear(ASSESSMENT_YEARS))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lockRef = useRef(false)
  const wardsQuery = useUlbWards(assignment && assignment.wardId === null ? assignment.ulbId : null)

  const effectiveWard: WardChoice | null =
    assignment?.wardId ? { wardId: assignment.wardId, label: assignment.wardLabel ?? "Assigned ward" } : ward

  const create = async () => {
    if (!assignment || !effectiveWard || lockRef.current) return
    lockRef.current = true
    setBusy(true)
    setError(null)
    try {
      const record = await createSurvey({
        stateId: assignment.stateId,
        districtId: assignment.districtId,
        ulbId: assignment.ulbId,
        wardId: effectiveWard.wardId,
        propertyId: propertyId.trim() || temporaryPropertyId(randomUUID()),
        assessmentYear: year,
      })
      invalidateLists()
      router.replace({ pathname: "/(app)/surveys/[id]", params: { id: record.id } })
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not create the survey. Check your connection and try again."))
    } finally {
      lockRef.current = false
      setBusy(false)
    }
  }

  if (assignments.length === 0) {
    return (
      <Screen>
        <StatusView
          variant="empty"
          title="No ward assigned"
          description="Ask your administrator to assign you a district, ULB and ward before starting surveys."
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </Screen>
    )
  }

  return (
    <Screen scroll keyboard>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <Text variant="bodyStrong" tone="primary">
          ‹ Back
        </Text>
      </Pressable>
      <Text variant="title" style={styles.title}>
        New survey
      </Text>

      <View style={[cardStyle, styles.card]}>
        <Text variant="label">Assignment *</Text>
        {assignments.map((a) => {
          const selected = assignment?.key === a.key
          return (
            <Pressable
              key={a.key}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                setAssignment(a)
                setWard(null)
              }}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Text variant="bodyStrong" tone={selected ? "inverse" : "default"}>
                {a.ulbName}
              </Text>
              <Text variant="caption" tone={selected ? "inverse" : "secondary"}>
                {a.wardLabel ? `Ward ${a.wardLabel}` : "All wards"}
              </Text>
            </Pressable>
          )
        })}

        {assignment && assignment.wardId === null ? (
          <View style={styles.wards}>
            <Text variant="label">Ward *</Text>
            {wardsQuery.isPending ? <ActivityIndicator color={colors.primary} /> : null}
            {wardsQuery.isError ? (
              <Text variant="caption" tone="danger">
                {getApiErrorMessage(wardsQuery.error, "Could not load wards")}
              </Text>
            ) : null}
            <View style={styles.chips}>
              {(wardsQuery.data?.items ?? []).map((w) => {
                const selected = ward?.wardId === w.id
                return (
                  <Pressable
                    key={w.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setWard({ wardId: w.id, label: `${w.wardNumber} · ${w.wardName}` })}
                    style={[styles.chip, selected && styles.optionSelected]}
                  >
                    <Text variant="label" tone={selected ? "inverse" : "default"}>
                      {w.wardNumber} · {w.wardName}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        ) : null}
      </View>

      <View style={[cardStyle, styles.card]}>
        <TextField
          label="Property ID (optional)"
          value={propertyId}
          onChangeText={setPropertyId}
          autoCapitalize="characters"
          maxLength={100}
          placeholder="Leave empty to auto-generate"
        />
        <OptionChips label="Assessment year" required options={ASSESSMENT_YEARS} value={year} onChange={(v) => v && setYear(v)} />
      </View>

      {error ? (
        <Text variant="caption" tone="danger" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Button title="Start survey" loading={busy} disabled={!assignment || !effectiveWard} onPress={() => void create()} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  back: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  title: { marginBottom: spacing.lg },
  card: { gap: spacing.md, marginBottom: spacing.lg },
  option: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  optionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  wards: { gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { marginBottom: spacing.md },
})
