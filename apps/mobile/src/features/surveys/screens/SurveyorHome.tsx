import { Button, Screen, Text, cardStyle } from "@/components/ui"
import { getApiErrorMessage } from "@/services/api/client"
import { colors, radius, spacing } from "@/theme"
import type { AuthenticatedProfile } from "@/types/user"
import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useState, type ReactNode } from "react"
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native"
import { useFieldMetrics, useSurveyList, useTodayDrafts } from "../hooks/queries"
import { listPendingSurveyIds } from "../lib/pending-store"
import { NewSurveyButton } from "../ui/new-survey-button"
import { MetricTile } from "../ui/primitives"
import { SurveyRow } from "../ui/SurveyRow"
import type { ListFilterId } from "./SurveyListScreen"

export function SurveyorHome({
  profile,
  submittedId,
  onSignOut,
}: {
  profile: AuthenticatedProfile
  submittedId: string | null
  onSignOut: () => void
}) {
  const router = useRouter()
  const metrics = useFieldMetrics("self")
  const returned = useSurveyList({ surveyorId: profile.id, surveyStatus: "REJECTED" })
  const reopened = useSurveyList({ surveyorId: profile.id, surveyStatus: "REOPENED" })
  const todayDrafts = useTodayDrafts(profile.id)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      void listPendingSurveyIds(profile.id).then((ids) => {
        if (!cancelled) setPendingIds(new Set(ids))
      })
      return () => {
        cancelled = true
      }
    }, [profile.id]),
  )

  const refreshing =
    metrics.isRefetching || returned.isRefetching || reopened.isRefetching || todayDrafts.isRefetching
  const refresh = () => {
    void metrics.refetch()
    void returned.refetch()
    void reopened.refetch()
    todayDrafts.refetch()
  }
  const openList = (filter: ListFilterId) =>
    router.push({ pathname: "/(app)/surveys/list", params: { filter, surveyorId: profile.id } })
  const openSurvey = (id: string) => router.push({ pathname: "/(app)/surveys/[id]", params: { id } })

  const corrections = [
    ...(returned.data?.pages[0]?.items ?? []),
    ...(reopened.data?.pages[0]?.items ?? []),
  ].slice(0, 5)
  const drafts = todayDrafts.items
  const t = metrics.data?.totals

  return (
    <Screen padded={false}>
      <View style={styles.pinned}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text variant="caption" tone="secondary">
              Surveyor
            </Text>
            <Text variant="title" numberOfLines={1}>
              {profile.fullName}
            </Text>
          </View>
          <Button title="Sign out" variant="ghost" onPress={onSignOut} />
        </View>
        {submittedId ? (
          <View style={styles.success}>
            <Text variant="bodyStrong" style={{ color: colors.success }}>
              Survey submitted for QC
            </Text>
            <Text variant="caption" tone="secondary">
              It is locked until QC approves it or requests changes.
            </Text>
          </View>
        ) : null}
        <NewSurveyButton onPress={() => router.push("/(app)/surveys/new")} />
      </View>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Text variant="label" tone="secondary" style={styles.sectionLabel}>
          My progress
        </Text>
        {metrics.isPending ? (
          <ActivityIndicator color={colors.primary} />
        ) : metrics.isError ? (
          <View style={[cardStyle, styles.gap]}>
            <Text variant="caption" tone="danger">
              {getApiErrorMessage(metrics.error, "Could not load your dashboard")}
            </Text>
            <Button title="Retry" variant="secondary" onPress={() => void metrics.refetch()} />
          </View>
        ) : t ? (
          <>
            <View style={styles.tiles}>
              <Tap onPress={() => openList("inProgress")}>
                <MetricTile label="Drafts" value={t.fieldDraft} />
              </Tap>
              <Tap onPress={() => openList("underQc")}>
                <MetricTile label="Under QC" value={t.pendingQc} tone="progress" />
              </Tap>
              <Tap onPress={() => openList("returned")}>
                <MetricTile label="Needs correction" value={t.returned + t.rework} tone="danger" />
              </Tap>
              <Tap onPress={() => openList("approved")}>
                <MetricTile label="Approved" value={t.approved} tone="success" />
              </Tap>
            </View>
            <View style={[cardStyle, styles.today]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Created today"
                onPress={() => openList("today")}
                style={styles.todayStat}
              >
                <TodayStat label="Created today" value={t.createdToday} />
              </Pressable>
              <TodayStat label="Submitted today" value={t.submittedToday} />
              <TodayStat label="Resubmitted" value={t.resubmitted} />
            </View>
          </>
        ) : null}

        {corrections.length ? (
          <>
            <Text variant="label" tone="danger" style={styles.sectionLabel}>
              Needs correction
            </Text>
            <View style={styles.gap}>
              {corrections.map((s) => (
                <SurveyRow key={s.id} survey={s} unsynced={pendingIds.has(s.id)} onPress={() => openSurvey(s.id)} />
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.sectionRow}>
          <Text variant="label" tone="secondary">
            Continue drafts
          </Text>
          <Pressable accessibilityRole="link" onPress={() => openList("all")} style={styles.link}>
            <Text variant="label" tone="primary">
              All surveys ›
            </Text>
          </Pressable>
        </View>
        {todayDrafts.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : todayDrafts.isError ? (
          <View style={[cardStyle, styles.gap]}>
            <Text variant="caption" tone="danger">
              {getApiErrorMessage(todayDrafts.error, "Could not load today's drafts")}
            </Text>
            <Button title="Retry" variant="secondary" onPress={() => todayDrafts.refetch()} />
          </View>
        ) : drafts.length ? (
          <View style={styles.gap}>
            {drafts.map((s) => (
              <SurveyRow key={s.id} survey={s} unsynced={pendingIds.has(s.id)} onPress={() => openSurvey(s.id)} />
            ))}
          </View>
        ) : (
          <Text variant="caption" tone="secondary">
            No drafts created today.
          </Text>
        )}

        {metrics.data && metrics.data.wards.length > 0 ? (
          <>
            <Text variant="label" tone="secondary" style={styles.sectionLabel}>
              By ward
            </Text>
            <View style={styles.gap}>
              {metrics.data.wards.map((w) => (
                <View key={w.wardId} style={[cardStyle, styles.wardRow]}>
                  <View style={styles.flex}>
                    <Text variant="bodyStrong">
                      Ward {w.wardNumber ?? "—"}
                      {w.wardName ? ` · ${w.wardName}` : ""}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      {w.ulbName ?? ""}
                    </Text>
                  </View>
                  <Text variant="caption" tone="secondary">
                    {w.totals.fieldDraft} draft · {w.totals.pendingQc} QC · {w.totals.returned + w.totals.rework} fix ·{" "}
                    {w.totals.approved} ok
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

function Tap({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.tap}>
      {children}
    </Pressable>
  )
}

function TodayStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.todayStat}>
      <Text variant="heading">{value}</Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
  pinned: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  success: {
    gap: 2,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.successMuted,
  },
  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  link: { minHeight: 36, justifyContent: "center" },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  tap: { flexGrow: 1, flexBasis: "45%" },
  today: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md, padding: spacing.lg },
  todayStat: { alignItems: "center", flex: 1 },
  gap: { gap: spacing.sm },
  wardRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
})
