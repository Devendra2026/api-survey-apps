import { Screen, StatusView, Text, cardStyle } from "@/components/ui"
import { getApiErrorMessage, isApiClientError } from "@/services/api/client"
import { reopenSurvey, submitSurvey } from "@/services/api/surveys"
import { colors, radius, spacing } from "@/theme"
import type { AuthenticatedProfile } from "@/types/user"
import { useRouter } from "expo-router"
import { useCallback, useMemo, useRef, useState } from "react"
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useInvalidateSurveyLists, useRecordCache, useSurveyRecord } from "../hooks/queries"
import { useSurveyAutosave } from "../hooks/use-survey-autosave"
import { fieldBucket, isAlreadySubmittedError, isFieldEditable, needsReopenBeforeEdit } from "../lib/lifecycle"
import {
  canAdvanceFromStep,
  nextStepId,
  overallCompletionPercent,
  previousStepId,
} from "../lib/navigation"
import { clearPendingPatch } from "../lib/pending-store"
import {
  STEP_IDS,
  STEP_TITLES,
  mobileFieldRequirements,
  stepForRemarkSection,
  stepForServerMessage,
  stepProgress,
  type StepId,
  type SurveySnapshot,
} from "../lib/requirements"
import { previewPropertyId } from "../lib/property-identity"
import { hasUnsyncedChanges } from "../lib/sync-state"
import { CorrectionPanel } from "../ui/CorrectionPanel"
import { ReviewSection } from "../ui/ReviewSection"
import { BottomActionBar, SurveyHeader, ValidationBanner } from "../ui/SurveyChrome"
import { SurveyStepBody } from "../ui/SurveyStepBody"
import { StepChips } from "../ui/primitives"

export function SurveyWizard({
  surveyId,
  profile,
  initialStep,
}: {
  surveyId: string
  profile: AuthenticatedProfile
  initialStep: StepId | null
}) {
  const router = useRouter()
  const recordCache = useRecordCache()
  const invalidateLists = useInvalidateSurveyLists()
  const recordQuery = useSurveyRecord(surveyId)
  const record = recordQuery.data
  const isWorker = record ? record.createdById === profile.id || record.assignedToId === profile.id : false
  const editable = Boolean(record && isWorker && isFieldEditable(record.surveyStatus))
  const autosave = useSurveyAutosave({ userId: profile.id, record, enabled: editable })
  const [step, setStep] = useState<StepId>(initialStep ?? "start")
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [serverErrors, setServerErrors] = useState<string[]>([])
  const [navHint, setNavHint] = useState<string | null>(null)
  const submitLockRef = useRef(false)
  const scrollRef = useRef<ScrollView>(null)

  const snapshot = useMemo<SurveySnapshot | null>(() => {
    if (!record || !autosave.fields) return null
    const preview = previewPropertyId({
      ulbCode: record.ulbCode ?? record.ulb?.code,
      wardNo: record.ward?.wardNumber,
      currentWard: record.ward,
      originalWard: record.originalWard,
      storedWardNumber: record.wardNumber,
      parcelNo: autosave.fields.parcelNumber,
      unitNo: autosave.fields.unitSubNo,
      propertyUse: autosave.fields.propertyUse,
    })
    return {
      ...autosave.fields,
      propertyId: preview ?? autosave.fields.propertyId,
      wardLabel: record.ward ? `${record.ward.wardNumber} · ${record.ward.wardName}` : null,
      floorCount: record.floors.length,
      coOwnerCount: record.coOwners.length,
      uploadedPhotoTypes: record.photos.filter((p) => p.objectKey).map((p) => p.photoType),
    }
  }, [record, autosave.fields])

  const progress = useMemo(() => (snapshot ? stepProgress(snapshot) : null), [snapshot])
  const requirements = useMemo(() => (snapshot ? mobileFieldRequirements(snapshot) : []), [snapshot])
  const completionPercent = useMemo(() => (progress ? overallCompletionPercent(progress) : 0), [progress])

  const goTo = useCallback(
    (next: StepId) => {
      setNavHint(null)
      void autosave.flush()
      setStep(next)
      scrollRef.current?.scrollTo({ y: 0, animated: false })
    },
    [autosave],
  )

  const startCorrection = async () => {
    if (!record) return
    setReopening(true)
    try {
      const reopened = await reopenSurvey(record.id)
      recordCache.write(reopened)
      invalidateLists()
      await recordQuery.refetch()
    } catch (e) {
      Alert.alert("Could not start correction", getApiErrorMessage(e))
    } finally {
      setReopening(false)
    }
  }

  const saveDraft = async () => {
    if (!editable || savingDraft) return
    setSavingDraft(true)
    setNavHint(null)
    try {
      const synced = await autosave.flush()
      if (!synced) {
        Alert.alert(
          "Draft saved on this device",
          "Could not reach the server. Your changes are kept locally and will sync when you are back online.",
        )
      }
    } finally {
      setSavingDraft(false)
    }
  }

  const submit = async () => {
    if (!record || submitLockRef.current) return
    if (requirements.length > 0) {
      const sections = [...new Set(requirements.map((r) => r.step))]
      setStep(requirements[0]!.step)
      setNavHint(`Please complete the required fields before submitting. ${sections.join(", ")}`)
      return
    }
    submitLockRef.current = true
    setSubmitting(true)
    setServerErrors([])
    setNavHint(null)
    try {
      const synced = await autosave.flush()
      if (!synced) {
        Alert.alert(
          "Changes not synced",
          "Some edits are only saved on this device. Connect to the internet and try again — nothing has been lost.",
        )
        return
      }
      const submitted = await submitSurvey(record.id)
      recordCache.write(submitted)
      await clearPendingPatch(profile.id, record.id)
      invalidateLists()
      router.replace({ pathname: "/(app)/survey", params: { submitted: record.id } })
    } catch (e) {
      const message = getApiErrorMessage(e, "Submission failed")
      if (isAlreadySubmittedError(message)) {
        await recordQuery.refetch()
        invalidateLists()
        router.replace({ pathname: "/(app)/survey", params: { submitted: record.id } })
        return
      }
      const list = isApiClientError(e) && e.errors?.length ? e.errors : [message]
      setServerErrors(list)
      const target = list.map(stepForServerMessage).find((s): s is StepId => s !== null)
      if (target) setStep(target)
      await recordQuery.refetch()
    } finally {
      submitLockRef.current = false
      setSubmitting(false)
    }
  }

  if (recordQuery.isPending) {
    return (
      <Screen>
        <StatusView variant="loading" title="Loading survey…" />
      </Screen>
    )
  }
  if (recordQuery.isError || !record || !snapshot || !progress || !autosave.fields) {
    return (
      <Screen>
        <StatusView
          variant="error"
          title="Could not load survey"
          description={getApiErrorMessage(recordQuery.error, "Check your connection and try again.")}
          actionLabel="Retry"
          onAction={() => void recordQuery.refetch()}
          secondaryLabel="Back"
          onSecondary={() => router.back()}
        />
      </Screen>
    )
  }

  const bucket = fieldBucket(record.surveyStatus, record.qcStatus)
  const index = STEP_IDS.indexOf(step)
  const isLast = index === STEP_IDS.length - 1
  const stepMissing = progress[step].missing
  const unsynced = hasUnsyncedChanges(autosave.status) || autosave.hasPending
  const nextId = nextStepId(step)
  const prevId = previousStepId(step)
  const forwardGate = progress ? canAdvanceFromStep(step, progress) : { allowed: true as const }
  const nextDisabledReason =
    navHint ??
    (!forwardGate.allowed ? forwardGate.reason : null) ??
    (isLast && requirements.length > 0
      ? `Complete before submit: ${requirements.map((r) => r.message).join("; ")}`
      : null)

  const leave = () => {
    void autosave.flush()
    if (router.canGoBack()) router.back()
    else router.replace("/(app)/survey")
  }

  const wardLine = `${snapshot.wardLabel ? `Ward ${snapshot.wardLabel}` : "Ward —"}${record.ulb ? ` · ${record.ulb.name}` : ""
    }`

  return (
    <Screen padded={false} keyboard>
      <SurveyHeader
        propertyId={previewPropertyId({
          ulbCode: record.ulbCode ?? record.ulb?.code,
          wardNo: record.ward?.wardNumber,
          currentWard: record.ward,
          originalWard: record.originalWard,
          storedWardNumber: record.wardNumber,
          parcelNo: autosave.fields.parcelNumber,
          unitNo: autosave.fields.unitSubNo,
          propertyUse: autosave.fields.propertyUse,
        }) ?? "Property ID pending"}
        wardLine={wardLine}
        step={step}
        completionPercent={completionPercent}
        editable={editable}
        bucket={bucket}
        syncStatus={autosave.status}
        onBack={leave}
        onRetrySync={autosave.retry}
      />
      <View style={styles.chipsWrap}>
        <StepChips steps={STEP_IDS} current={step} progress={progress} onSelect={goTo} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {bucket === "needsCorrection" ? (
          <CorrectionPanel
            record={record}
            canReopen={isWorker && needsReopenBeforeEdit(record.surveyStatus)}
            reopening={reopening}
            onReopen={() => void startCorrection()}
            onGoTo={(section, body) => {
              const target = stepForRemarkSection(section, body)
              if (target) goTo(target)
            }}
          />
        ) : null}
        {!editable && bucket !== "needsCorrection" ? (
          <View style={[cardStyle, styles.notice]}>
            <Text variant="caption" tone="secondary">
              {isWorker ? "This survey is locked while it is with QC." : "Read-only view."}
            </Text>
          </View>
        ) : null}
        {serverErrors.length ? (
          <ValidationBanner title="Server rejected submission">
            {serverErrors.map((m) => (
              <Text key={m} variant="caption" tone="danger">
                • {m}
              </Text>
            ))}
          </ValidationBanner>
        ) : null}
        {stepMissing.length && editable && !isLast ? (
          <View style={styles.stepHints}>
            <Text variant="caption" tone="secondary">
              Required for submit on this step: {stepMissing.join(", ")}
            </Text>
          </View>
        ) : null}
        <SurveyStepBody
          step={step}
          record={record}
          fields={autosave.fields}
          snapshot={snapshot}
          progress={progress[step]}
          editable={editable}
          setFields={autosave.setFields}
        />
        {isLast ? (
          <>
            <ReviewSection
              snapshot={snapshot}
              record={record}
              editable={editable}
              onEdit={(target) => goTo(target)}
            />
            <View style={[cardStyle, styles.checklist]}>
              <Text variant="heading">Ready to submit?</Text>
              {requirements.length === 0 ? (
                <Text variant="body" style={{ color: colors.success }}>
                  All required items are complete.
                </Text>
              ) : (
                requirements.map((r) => (
                  <Pressable key={r.message} onPress={() => goTo(r.step)} style={styles.reqRow} accessibilityRole="link">
                    <Text variant="caption" tone="danger" style={styles.flex}>
                      • {r.message}
                    </Text>
                    <Text variant="caption" tone="primary">
                      {STEP_TITLES[r.step]} ›
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      <BottomActionBar
        canGoBack={Boolean(prevId)}
        canGoNext={isLast ? requirements.length === 0 : Boolean(nextId) && forwardGate.allowed}
        nextDisabledReason={nextDisabledReason}
        nextTitle={
          isLast
            ? bucket === "needsCorrection"
              ? "Resubmit for review"
              : "Submit for Review"
            : `Next: ${nextId ? STEP_TITLES[nextId] : ""}`
        }
        editable={editable}
        isLast={isLast}
        submitting={submitting}
        savingDraft={savingDraft}
        onBack={() => {
          if (prevId) goTo(prevId)
        }}
        onSaveDraft={() => void saveDraft()}
        onNext={() => {
          if (!forwardGate.allowed) {
            setNavHint(forwardGate.reason)
            return
          }
          if (nextId) goTo(nextId)
        }}
        onSubmit={() => void submit()}
        onDone={leave}
      />
      {isLast && editable && unsynced && requirements.length === 0 ? (
        <Text variant="caption" tone="secondary" style={styles.syncNote}>
          Pending edits are synced before submission.
        </Text>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  chipsWrap: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  body: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  notice: { marginBottom: spacing.lg, padding: spacing.lg },
  stepHints: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  checklist: { gap: spacing.sm, marginBottom: spacing.lg },
  reqRow: { flexDirection: "row", alignItems: "center", minHeight: 36, gap: spacing.sm },
  flex: { flex: 1 },
  syncNote: { textAlign: "center", paddingBottom: spacing.sm, backgroundColor: colors.surface },
})
