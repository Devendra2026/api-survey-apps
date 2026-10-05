import { Button, Screen, StatusView, Text, TextField, cardStyle } from "@/components/ui"
import { getApiErrorMessage, isApiClientError } from "@/services/api/client"
import { createSurvey } from "@/services/api/surveys"
import { colors, radius, spacing, touchTarget } from "@/theme"
import type { AuthenticatedProfile } from "@/types/user"
import { randomUUID } from "expo-crypto"
import { useRouter } from "expo-router"
import { useMemo, useRef, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native"
import { useInvalidateSurveyLists, useUlbWards } from "../hooks/queries"
import { surveyAssignments, temporaryPropertyId, type SurveyAssignment } from "../lib/assignments"
import { defaultAssessmentYear } from "../lib/labels"
import { sortWardsByNumber } from "../lib/ward-order"
import { ASSESSMENT_YEARS, type AssessmentYear } from "../types"
import { OptionChips } from "../ui/primitives"
import { WardDropdown } from "../ui/ward-dropdown"

type WardChoice = { wardId: string; label: string }

function wardLoadFailureMessage(error: unknown): string {
  if (isApiClientError(error)) {
    if (error.statusCode === 403) {
      return error.message || "You do not have permission to list wards for this ULB."
    }
    if (error.statusCode === 401) {
      return error.message || "Your session expired. Sign in again to load wards."
    }
    if (error.statusCode === 404) {
      return error.message || "No wards were found for this ULB."
    }
    if (error.kind === "network" || error.kind === "timeout") {
      return getApiErrorMessage(error, "Could not reach the server to load wards.")
    }
    return getApiErrorMessage(error, `Could not load wards (${error.statusCode || "error"}).`)
  }
  return getApiErrorMessage(error, "Could not load wards")
}

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
  const wardOptions = useMemo(
    () =>
      sortWardsByNumber(wardsQuery.data?.items ?? []).map((item) => ({
        value: item.id,
        label: `${item.wardNumber} · ${item.wardName}`,
      })),
    [wardsQuery.data?.items],
  )

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
            <WardDropdown
              options={wardOptions}
              value={ward?.wardId ?? null}
              disabled={wardsQuery.isPending || wardsQuery.isError || wardOptions.length === 0}
              onChange={(wardId) => {
                const match = wardOptions.find((option) => option.value === wardId)
                if (!match) return
                setWard({ wardId: match.value, label: match.label })
              }}
            />
            {wardsQuery.isPending ? <ActivityIndicator color={colors.primary} /> : null}
            {wardsQuery.isError ? (
              <View style={styles.wardError}>
                <Text variant="caption" tone="danger">
                  {wardLoadFailureMessage(wardsQuery.error)}
                </Text>
                <Button title="Retry" variant="secondary" onPress={() => void wardsQuery.refetch()} />
              </View>
            ) : null}
            {!wardsQuery.isPending && !wardsQuery.isError && wardOptions.length === 0 ? (
              <Text variant="caption" tone="secondary">
                No wards returned for this ULB. Contact an administrator.
              </Text>
            ) : null}
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
  back: { minHeight: touchTarget, justifyContent: "center", alignSelf: "flex-start" },
  title: { marginBottom: spacing.lg },
  card: { gap: spacing.md, marginBottom: spacing.lg },
  option: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
    minHeight: touchTarget,
  },
  optionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  wards: { gap: spacing.sm },
  wardError: { gap: spacing.sm },
  error: { marginBottom: spacing.md },
})
