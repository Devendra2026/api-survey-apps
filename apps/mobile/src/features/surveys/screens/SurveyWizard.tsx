import { Button, Screen, StatusView, Text, cardStyle } from "@/components/ui"
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
import { clearPendingPatch } from "../lib/pending-store"
import {
  STEP_IDS,
  STEP_TITLES,
  stepForRemarkSection,
  stepForServerMessage,
  stepProgress,
  submitRequirements,
  type StepId,
  type SurveySnapshot,
} from "../lib/requirements"
import { hasUnsyncedChanges } from "../lib/sync-state"
import { CorrectionPanel } from "../ui/CorrectionPanel"
import { SurveyStepBody } from "../ui/SurveyStepBody"
import { StatusBadge, StepChips, SyncChip } from "../ui/primitives"

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
  const [reopening, setReopening] = useState(false)
  const [serverErrors, setServerErrors] = useState<string[]>([])
  const submitLockRef = useRef(false)
  const scrollRef = useRef<ScrollView>(null)

  const snapshot = useMemo<SurveySnapshot | null>(() => {
    if (!record || !autosave.fields) return null
    return {
      ...autosave.fields,
      wardLabel: record.ward ? `${record.ward.wardNumber} · ${record.ward.wardName}` : null,
      floorCount: record.floors.length,
      coOwnerCount: record.coOwners.length,
      uploadedPhotoTypes: record.photos.filter((p) => p.objectKey).map((p) => p.photoType),
    }
  }, [record, autosave.fields])

  const progress = useMemo(() => (snapshot ? stepProgress(snapshot) : null), [snapshot])
  const requirements = useMemo(() => (snapshot ? submitRequirements(snapshot) : []), [snapshot])

  const goTo = useCallback(
    (next: StepId) => {
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

  const submit = async () => {
    if (!record || submitLockRef.current) return
    if (requirements.length > 0) {
      setStep(requirements[0]!.step)
      return
    }
    submitLockRef.current = true
    setSubmitting(true)
    setServerErrors([])
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
        // A previous attempt reached the server (e.g. response lost on a flaky network).
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

  const leave = () => {
    void autosave.flush()
    if (router.canGoBack()) router.back()
    else router.replace("/(app)/survey")
  }

  return (
    <Screen padded={false} keyboard>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={leave} style={styles.back}>
            <Text variant="bodyStrong" tone="primary">
              ‹ Back
            </Text>
          </Pressable>
          {editable ? <SyncChip status={autosave.status} onRetry={autosave.retry} /> : <StatusBadge bucket={bucket} />}
        </View>
        <Text variant="heading" numberOfLines={1}>
          {autosave.fields.propertyId}
        </Text>
        <View style={styles.headerRow}>
          <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.flex}>
            {snapshot.wardLabel ? `Ward ${snapshot.wardLabel}` : "Ward —"}
            {record.ulb ? ` · ${record.ulb.name}` : ""}
          </Text>
          {editable ? <StatusBadge bucket={bucket} /> : null}
        </View>
        <StepChips steps={STEP_IDS} current={step} progress={progress} onSelect={goTo} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
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
          <View style={styles.serverErrors}>
            <Text variant="label" tone="danger">
              Server rejected submission
            </Text>
            {serverErrors.map((m) => (
              <Text key={m} variant="caption" tone="danger">
                • {m}
              </Text>
            ))}
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
        {isLast && editable ? (
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
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {stepMissing.length && !isLast && editable ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            Required later: {stepMissing.join(", ")}
          </Text>
        ) : null}
        <View style={styles.footerRow}>
          <Button
            title="Back"
            variant="secondary"
            disabled={index === 0}
            onPress={() => goTo(STEP_IDS[Math.max(0, index - 1)]!)}
            style={styles.flex}
          />
          {isLast ? (
            editable ? (
              <Button
                title={bucket === "needsCorrection" ? "Resubmit for QC" : "Submit for QC"}
                loading={submitting}
                disabled={requirements.length > 0 || submitting}
                onPress={() => void submit()}
                style={styles.flex2}
              />
            ) : (
              <Button title="Done" onPress={leave} style={styles.flex2} />
            )
          ) : (
            <Button title="Next" onPress={() => goTo(STEP_IDS[index + 1]!)} style={styles.flex2} />
          )}
        </View>
        {isLast && editable && unsynced && requirements.length === 0 ? (
          <Text variant="caption" tone="secondary">
            Pending edits are synced before submission.
          </Text>
        ) : null}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  back: { minHeight: 44, justifyContent: "center", paddingRight: spacing.md },
  body: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  notice: { marginBottom: spacing.lg, padding: spacing.lg },
  serverErrors: {
    gap: spacing.xs,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.dangerMuted,
  },
  checklist: { gap: spacing.sm, marginBottom: spacing.lg },
  reqRow: { flexDirection: "row", alignItems: "center", minHeight: 36, gap: spacing.sm },
  footer: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerRow: { flexDirection: "row", gap: spacing.md },
  flex: { flex: 1 },
  flex2: { flex: 2 },
})
