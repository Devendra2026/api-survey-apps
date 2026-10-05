import { Button, Text } from "@/components/ui"
import { getApiErrorMessage } from "@/services/api/client"
import { createCoOwner, deleteCoOwner, updateCoOwner, type CoOwnerWrite } from "@/services/api/surveys"
import { colors, radius, spacing, touchTarget } from "@/theme"
import { useCallback, useEffect, useRef, useState } from "react"
import { Alert, StyleSheet, View } from "react-native"
import { useRecordCache } from "../hooks/queries"
import { phoneError } from "../lib/field-format"
import { registerOwnerFlush } from "../lib/owner-flush"
import { ownerContactPatch, primaryOwnerId, sortOwners } from "../lib/owner-mapping"
import type { SurveyCoOwner, SurveyPatch } from "../types"
import { BoundTextField } from "./primitives"

type Draft = {
  name: string
  fatherOrHusbandName: string
  mobile: string
  alternateMobile: string
}

const EMPTY_DRAFT: Draft = { name: "", fatherOrHusbandName: "", mobile: "", alternateMobile: "" }

function blankToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function toWrite(draft: Draft): CoOwnerWrite {
  return {
    name: draft.name.trim(),
    fatherOrHusbandName: blankToNull(draft.fatherOrHusbandName),
    mobile: blankToNull(draft.mobile),
    alternateMobile: blankToNull(draft.alternateMobile),
  }
}

function sameDraft(left: Draft, right: Draft): boolean {
  return (
    left.name.trim() === right.name.trim() &&
    left.fatherOrHusbandName.trim() === right.fatherOrHusbandName.trim() &&
    left.mobile.trim() === right.mobile.trim() &&
    left.alternateMobile.trim() === right.alternateMobile.trim()
  )
}

function draftFromOwner(owner: SurveyCoOwner): Draft {
  return {
    name: owner.name,
    fatherOrHusbandName: owner.fatherOrHusbandName ?? "",
    mobile: owner.mobile ?? "",
    alternateMobile: owner.alternateMobile ?? "",
  }
}

type ContactHandler = (patch: Pick<SurveyPatch, "mobileNumber" | "alternateMobile">) => void

export function OwnersEditor({
  surveyId,
  coOwners,
  editable,
  onPrimaryContact,
}: {
  surveyId: string
  coOwners: SurveyCoOwner[]
  editable: boolean
  onPrimaryContact: ContactHandler
}) {
  const owners = sortOwners(coOwners)
  const primaryId = primaryOwnerId(owners)
  const [adding, setAdding] = useState(owners.length === 0)

  return (
    <View style={styles.wrap}>
      <Text variant="label">Owners</Text>
      {owners.map((owner, index) => (
        <OwnerCard
          key={owner.id}
          surveyId={surveyId}
          owner={owner}
          title={`Owner ${index + 1}`}
          isPrimary={owner.id === primaryId}
          editable={editable}
          onPrimaryContact={onPrimaryContact}
        />
      ))}
      {editable && adding ? (
        <NewOwnerForm
          surveyId={surveyId}
          title={`Owner ${owners.length + 1}`}
          isPrimary={owners.length === 0}
          onPrimaryContact={onPrimaryContact}
          onSaved={() => setAdding(false)}
        />
      ) : null}
      {editable && !adding ? (
        <Button title="Add another owner" variant="secondary" onPress={() => setAdding(true)} />
      ) : null}
    </View>
  )
}

function OwnerCard({
  surveyId,
  owner,
  title,
  isPrimary,
  editable,
  onPrimaryContact,
}: {
  surveyId: string
  owner: SurveyCoOwner
  title: string
  isPrimary: boolean
  editable: boolean
  onPrimaryContact: ContactHandler
}) {
  const recordCache = useRecordCache()
  const [draft, setDraft] = useState<Draft>(() => draftFromOwner(owner))
  const latest = useRef(draft)
  const saved = useRef(draftFromOwner(owner))

  const publishContact = (next: Draft) => {
    const patch = ownerContactPatch({
      isPrimary,
      mobile: blankToNull(next.mobile),
      alternateMobile: blankToNull(next.alternateMobile),
    })
    if (patch) onPrimaryContact(patch)
  }

  useEffect(() => {
    return registerOwnerFlush(async () => {
      const next = latest.current
      if (!next.name.trim() || sameDraft(next, saved.current)) return
      const row = await updateCoOwner(owner.id, toWrite(next))
      saved.current = draftFromOwner(row)
      recordCache.update(surveyId, (record) => ({
        ...record,
        coOwners: record.coOwners.map((item) => (item.id === row.id ? row : item)),
      }))
      const patch = ownerContactPatch({
        isPrimary,
        mobile: row.mobile,
        alternateMobile: row.alternateMobile,
      })
      if (patch) onPrimaryContact(patch)
    })
  }, [owner.id, surveyId, recordCache, isPrimary, onPrimaryContact])

  const remove = () => {
    Alert.alert(`Remove ${owner.name}?`, "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteCoOwner(owner.id)
            .then(() => {
              recordCache.update(surveyId, (record) => {
                const remaining = sortOwners(record.coOwners.filter((item) => item.id !== owner.id))
                const nextPrimary = remaining[0]
                onPrimaryContact({
                  mobileNumber: nextPrimary?.mobile ?? null,
                  alternateMobile: nextPrimary?.alternateMobile ?? null,
                })
                return { ...record, coOwners: remaining }
              })
            })
            .catch((error: unknown) => Alert.alert("Delete failed", getApiErrorMessage(error)))
        },
      },
    ])
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text variant="bodyStrong">{title}</Text>
        {editable ? (
          <Button title="Delete" variant="ghost" accessibilityLabel={`Delete ${title}`} onPress={remove} />
        ) : null}
      </View>
      <OwnerFields
        draft={draft}
        editable={editable}
        onChange={(next) => {
          latest.current = next
          setDraft(next)
          if (isPrimary) publishContact(next)
        }}
      />
    </View>
  )
}

function NewOwnerForm({
  surveyId,
  title,
  isPrimary,
  onPrimaryContact,
  onSaved,
}: {
  surveyId: string
  title: string
  isPrimary: boolean
  onPrimaryContact: ContactHandler
  onSaved: () => void
}) {
  const recordCache = useRecordCache()
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)
  const latest = useRef(draft)
  const creating = useRef(false)
  const emptyAlertAt = useRef(0)

  const persist = useCallback(async (): Promise<void> => {
    const next = latest.current
    if (!next.name.trim() || creating.current) return
    creating.current = true
    setBusy(true)
    try {
      const row = await createCoOwner({ surveyId, ...toWrite(next) })
      latest.current = EMPTY_DRAFT
      setDraft(EMPTY_DRAFT)
      recordCache.update(surveyId, (record) => ({ ...record, coOwners: [...record.coOwners, row] }))
      const patch = ownerContactPatch({
        isPrimary,
        mobile: row.mobile,
        alternateMobile: row.alternateMobile,
      })
      if (patch) onPrimaryContact(patch)
      onSaved()
    } finally {
      creating.current = false
      setBusy(false)
    }
  }, [surveyId, isPrimary, recordCache, onPrimaryContact, onSaved])

  useEffect(() => {
    return registerOwnerFlush(() => persist())
  }, [persist])

  const startCreate = () => {
    if (busy || creating.current) return
    if (!latest.current.name.trim()) {
      const now = Date.now()
      if (now - emptyAlertAt.current < 500) return
      emptyAlertAt.current = now
      Alert.alert("Enter the owner name")
      return
    }
    void persist().catch((error: unknown) => {
      Alert.alert("Could not create owner", getApiErrorMessage(error))
    })
  }

  return (
    <View style={styles.card}>
      <Text variant="bodyStrong">{title}</Text>
      <OwnerFields
        draft={draft}
        editable={!busy}
        onChange={(next) => {
          latest.current = next
          setDraft(next)
          if (isPrimary) {
            const patch = ownerContactPatch({
              isPrimary: true,
              mobile: blankToNull(next.mobile),
              alternateMobile: blankToNull(next.alternateMobile),
            })
            if (patch) onPrimaryContact(patch)
          }
        }}
      />
      <Button title="Create owner" loading={busy} disabled={busy} onPressIn={startCreate} onPress={startCreate} />
    </View>
  )
}

function OwnerFields({
  draft,
  editable,
  onChange,
}: {
  draft: Draft
  editable: boolean
  onChange: (next: Draft) => void
}) {
  return (
    <View style={styles.fields}>
      <BoundTextField
        label="Owner name"
        required
        value={draft.name}
        editable={editable}
        autoCapitalize="words"
        onCommit={(name) => onChange({ ...draft, name })}
      />
      <BoundTextField
        label="Father/Husband name"
        value={draft.fatherOrHusbandName}
        editable={editable}
        autoCapitalize="words"
        onCommit={(fatherOrHusbandName) => onChange({ ...draft, fatherOrHusbandName })}
      />
      <BoundTextField
        label="Mobile number"
        value={draft.mobile}
        editable={editable}
        keyboardType="phone-pad"
        maxLength={15}
        error={phoneError(draft.mobile || null)}
        onCommit={(mobile) => onChange({ ...draft, mobile })}
      />
      <BoundTextField
        label="Alternate mobile number"
        value={draft.alternateMobile}
        editable={editable}
        keyboardType="phone-pad"
        maxLength={15}
        error={phoneError(draft.alternateMobile || null)}
        onCommit={(alternateMobile) => onChange({ ...draft, alternateMobile })}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: touchTarget,
  },
  fields: { gap: spacing.lg },
})
