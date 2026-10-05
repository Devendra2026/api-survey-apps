import { Button, Screen, StatusView, Text, TextField, cardStyle } from "@/components/ui"
import { getApiErrorMessage, isApiClientError } from "@/services/api/client"
import { createSurvey } from "@/services/api/surveys"
import { colors, radius, spacing, touchTarget } from "@/theme"
import type { AuthenticatedProfile } from "@/types/user"
import { padUlbCode } from "@workspace/validation"
import { randomUUID } from "expo-crypto"
import { useRouter } from "expo-router"
import { useMemo, useRef, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useInvalidateSurveyLists, useUlbWards } from "../hooks/queries"
import { surveyAssignments, temporaryPropertyId, type SurveyAssignment } from "../lib/assignments"
import { defaultAssessmentYear } from "../lib/labels"
import { overallCompletionPercent } from "../lib/navigation"
import { previewPropertyIdStart } from "../lib/property-identity"
import { STEP_IDS, type StepId, type StepProgress } from "../lib/requirements"
import { sortWardsByNumber } from "../lib/ward-order"
import { ASSESSMENT_YEARS, type AssessmentYear } from "../types"
import { OptionChips } from "../ui/primitives"
import { BottomActionBar, SurveyHeader } from "../ui/SurveyChrome"
import { WardDropdown } from "../ui/ward-dropdown"

type WardChoice = { wardId: string; label: string; wardNumber: string }

const PROPERTY_ID_HELPER =
  "Parcel, unit, and property-use letter are filled on the later property and taxation steps. The server saves the final ID."

function displayUlbCode(code: string | null | undefined): string {
  return padUlbCode((code ?? "").trim())
}

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
        wardNumber: item.wardNumber,
      })),
    [wardsQuery.data?.items],
  )

  const effectiveWard: WardChoice | null = assignment?.wardId
    ? {
      wardId: assignment.wardId,
      label: assignment.wardLabel ?? "Assigned ward",
      wardNumber: assignment.wardNumber ?? "",
    }
    : ward
  const selectedWardNumber = assignment?.wardId ? assignment.wardNumber : (ward?.wardNumber ?? null)
  const propertyIdPreview = previewPropertyIdStart({
    ulbCode: assignment?.ulbCode,
    wardNo: selectedWardNumber,
  })
  const ulbCodeLabel = displayUlbCode(assignment?.ulbCode)
  const ready = Boolean(assignment && effectiveWard)
  const progress = useMemo(() => {
    const result = {} as Record<StepId, StepProgress>
    for (const id of STEP_IDS) {
      result[id] = { filled: 0, total: 1, missing: [] }
    }
    result.start = { filled: ready ? 1 : 0, total: 1, missing: [] }
    return result
  }, [ready])
  const wardLine = [effectiveWard ? `Ward ${effectiveWard.label}` : null, assignment?.ulbName ?? null]
    .filter((part): part is string => Boolean(part))
    .join(" · ")

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
        propertyId: temporaryPropertyId(randomUUID()),
        assessmentYear: year,
      })
      invalidateLists()
      router.replace({ pathname: "/(app)/surveys/[id]", params: { id: record.id, step: "property" } })
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
    <Screen padded={false} keyboard>
      <SurveyHeader
        propertyId={propertyIdPreview ?? "Property ID pending"}
        wardLine={wardLine}
        step="start"
        progress={progress}
        completionPercent={overallCompletionPercent(progress)}
        editable
        bucket="draft"
        syncStatus={{ kind: "idle" }}
        onBack={() => router.back()}
        onRetrySync={() => undefined}
        onSelectStep={() => undefined}
        isStepEnabled={(step) => step === "start"}
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[cardStyle, styles.card]}>
          <OptionChips label="Assessment year" required options={ASSESSMENT_YEARS} value={year} onChange={(v) => v && setYear(v)} />
        </View>

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
                  setWard({ wardId: match.value, label: match.label, wardNumber: match.wardNumber })
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
          {assignment && assignment.wardId !== null ? (
            <TextField label="Ward *" value={assignment.wardLabel ?? "Assigned ward"} editable={false} />
          ) : null}
          {assignment ? (
            <TextField label="ULB code" value={ulbCodeLabel || "ULB code unavailable"} editable={false} />
          ) : null}
          {assignment ? (
            <View style={styles.preview}>
              <TextField
                label="Property ID"
                value={propertyIdPreview ?? ""}
                editable={false}
                placeholder="Select a ward to preview the Property ID"
              />
              <Text variant="caption" tone="secondary">
                {PROPERTY_ID_HELPER}
              </Text>
            </View>
          ) : null}
        </View>

        {error ? (
          <Text variant="caption" tone="danger" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <BottomActionBar
        canGoBack={false}
        canGoNext={ready && !busy}
        nextTitle={busy ? "Creating…" : "Next: Property"}
        editable={false}
        isLast={false}
        submitting={busy}
        savingDraft={false}
        onBack={() => undefined}
        onSaveDraft={() => undefined}
        onNext={() => void create()}
        onSubmit={() => undefined}
        onDone={() => router.back()}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxxl },
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
  preview: { gap: spacing.xs },
  wardError: { gap: spacing.sm },
  error: { marginBottom: spacing.md },
})
