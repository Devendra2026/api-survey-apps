import { Screen, StatusView, Text, cardStyle } from "@/components/ui"
import { getApiErrorMessage, isApiClientError } from "@/services/api/client"
import { reopenSurvey, submitSurvey } from "@/services/api/surveys"
import { colors, spacing } from "@/theme"
import type { AuthenticatedProfile } from "@/types/user"
import { useRouter } from "expo-router"
import { useCallback, useMemo, useRef, useState } from "react"
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { useInvalidateSurveyLists, useRecordCache, useSurveyRecord } from "../hooks/queries"
import { useSurveyAutosave } from "../hooks/use-survey-autosave"
import { surveyAssignments } from "../lib/assignments"
import { fieldBucket, isAlreadySubmittedError, isFieldEditable, needsReopenBeforeEdit } from "../lib/lifecycle"
import {
  canAdvanceFromStep,
  nextStepId,
  overallCompletionPercent,
  previousStepId,
} from "../lib/navigation"
import { flushOwnerEdits } from "../lib/owner-flush"
import { clearPendingPatch } from "../lib/pending-store"
import { displayPropertyId, propertyIdPreview } from "../lib/property-identity"
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
import { createSingleFlight } from "../lib/single-flight"
import { hasUnsyncedChanges } from "../lib/sync-state"
import { CorrectionPanel } from "../ui/CorrectionPanel"
import { ReviewSection } from "../ui/ReviewSection"
import { BottomActionBar, SurveyHeader, ValidationBanner } from "../ui/SurveyChrome"
import { SurveyStepBody } from "../ui/SurveyStepBody"

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
  const canPickWard = useMemo(() => {
    if (!record) return false
    return surveyAssignments(profile).some((item) => item.ulbId === record.ulbId && item.wardId === null)
  }, [profile, record])
  const autosave = useSurveyAutosave({ userId: profile.id, record, enabled: editable })
  const [step, setStep] = useState<StepId>(initialStep ?? "start")
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [serverErrors, setServerErrors] = useState<string[]>([])
  const submitFlight = useRef(createSingleFlight())
  const scrollRef = useRef<ScrollView>(null)

  const snapshot = useMemo<SurveySnapshot | null>(() => {
    if (!record || !autosave.fields) return null
    const preview = propertyIdPreview({
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
      propertyId: preview.isComplete ? preview.value ?? autosave.fields.propertyId : autosave.fields.propertyId,
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
      void flushOwnerEdits().then(() => autosave.flush())
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
    try {
      await flushOwnerEdits()
      const synced = await autosave.flush()
      if (!synced.ok && synced.reason === "offline") {
        Alert.alert(
          "Draft saved on this device",
          "Could not reach the server. Your changes are kept locally and will sync when you are back online.",
        )
      } else if (!synced.ok) {
        Alert.alert("Draft was not saved", synced.message)
      }
    } catch (error) {
      Alert.alert("Draft was not saved", getApiErrorMessage(error, "Could not save"))
    } finally {
      setSavingDraft(false)
    }
  }

  const submit = async () => {
    if (!record) return
    if (requirements.length > 0) {
      setStep(requirements[0]!.step)
      return
    }
    if (!submitFlight.current.tryBegin()) return
    setSubmitting(true)
    setServerErrors([])
    try {
      await flushOwnerEdits()
      const synced = await autosave.flush()
      if (!synced.ok) {
        Alert.alert(
          synced.reason === "offline" ? "Changes not synced" : "Draft was not saved",
          synced.reason === "offline"
            ? "Some edits are only saved on this device. Connect to the internet and try again — nothing has been lost."
            : synced.message,
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
      submitFlight.current.end()
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
  const unsynced = hasUnsyncedChanges(autosave.status) || autosave.hasPending
  const nextId = nextStepId(step)
  const prevId = previousStepId(step)
  const forwardGate = canAdvanceFromStep(step, progress)

  const leave = () => {
    void flushOwnerEdits().then(() => autosave.flush())
    if (router.canGoBack()) router.back()
    else router.replace("/(app)/survey")
  }

  const wardLine = `${snapshot.wardLabel ? `Ward ${snapshot.wardLabel}` : "Ward —"}${record.ulb ? ` · ${record.ulb.name}` : ""}`
  const identity = propertyIdPreview({
    ulbCode: record.ulbCode ?? record.ulb?.code,
    wardNo: record.ward?.wardNumber,
    currentWard: record.ward,
    originalWard: record.originalWard,
    storedWardNumber: record.wardNumber,
    parcelNo: autosave.fields.parcelNumber,
    unitNo: autosave.fields.unitSubNo,
    propertyUse: autosave.fields.propertyUse,
  })

  return (
    <Screen padded={false} keyboard>
      <SurveyHeader
        propertyId={displayPropertyId(identity)}
        wardLine={wardLine}
        step={step}
        progress={progress}
        completionPercent={completionPercent}
        editable={editable}
        bucket={bucket}
        syncStatus={autosave.status}
        onBack={leave}
        onRetrySync={autosave.retry}
        onSelectStep={goTo}
        onNewSurvey={() => router.push("/(app)/surveys/new")}
      />

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
        {step === "review" ? (
          <ReviewSection snapshot={snapshot} record={record} editable={editable} onEdit={(target) => goTo(target)} />
        ) : (
          <SurveyStepBody
            step={step}
            record={record}
            fields={autosave.fields}
            progress={progress[step]}
            editable={editable}
            canPickWard={canPickWard}
            setFields={autosave.setFields}
          />
        )}
        {isLast ? (
          <>
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
          if (nextId && forwardGate.allowed) goTo(nextId)
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
  body: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  notice: { marginBottom: spacing.lg, padding: spacing.lg },
  checklist: { gap: spacing.sm, marginBottom: spacing.lg },
  reqRow: { flexDirection: "row", alignItems: "center", minHeight: 36, gap: spacing.sm },
  flex: { flex: 1 },
  syncNote: { textAlign: "center", paddingBottom: spacing.sm, backgroundColor: colors.surface },
})
