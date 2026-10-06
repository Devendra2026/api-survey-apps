import { Screen, StatusView, Text } from "@/components/ui"
import { getApiErrorMessage } from "@/services/api/client"
import { colors, radius, spacing } from "@/theme"
import type { AuthenticatedProfile } from "@/types/user"
import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native"
import { useSurveyList, useTodayDrafts, type SurveyListFilter } from "../hooks/queries"
import { listPendingSurveyIds } from "../lib/pending-store"
import type { QcStatus, SurveyStatus } from "../types"
import { SurveyRow } from "../ui/SurveyRow"

export type ListFilterId = "all" | "today" | "draft" | "inProgress" | "underQc" | "returned" | "inCorrection" | "approved"

const FILTERS: { id: ListFilterId; label: string; surveyStatus?: SurveyStatus; qcStatus?: QcStatus }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "draft", label: "New", surveyStatus: "DRAFT" },
  { id: "inProgress", label: "In progress", surveyStatus: "IN_PROGRESS" },
  { id: "underQc", label: "Under QC", surveyStatus: "SUBMITTED", qcStatus: "PENDING" },
  { id: "returned", label: "Returned", surveyStatus: "REJECTED" },
  { id: "inCorrection", label: "In correction", surveyStatus: "REOPENED" },
  { id: "approved", label: "Approved", surveyStatus: "APPROVED" },
]

export function isListFilterId(value: string): value is ListFilterId {
  return FILTERS.some((f) => f.id === value)
}

export function SurveyListScreen({
  profile,
  initialFilter,
  surveyorId,
  title,
}: {
  profile: AuthenticatedProfile
  initialFilter: ListFilterId
  /** Restrict to one surveyor's assigned surveys (self list or supervisor drill-down). */
  surveyorId: string | null
  title: string
}) {
  const router = useRouter()
  const [filterId, setFilterId] = useState<ListFilterId>(initialFilter)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const isToday = filterId === "today"
  const filterDef = FILTERS.find((f) => f.id === filterId) ?? FILTERS[0]!
  const filter = useMemo<SurveyListFilter>(
    () => ({
      ...(filterDef.surveyStatus ? { surveyStatus: filterDef.surveyStatus } : {}),
      ...(filterDef.qcStatus ? { qcStatus: filterDef.qcStatus } : {}),
      ...(surveyorId ? { surveyorId } : {}),
    }),
    [filterDef, surveyorId],
  )
  const query = useSurveyList(filter, !isToday)
  const today = useTodayDrafts(surveyorId, isToday)
  const items = useMemo(
    () => (isToday ? today.items : (query.data?.pages.flatMap((p) => p.items) ?? [])),
    [isToday, query.data, today.items],
  )
  const isPending = isToday ? today.isLoading : query.isPending
  const isError = isToday ? today.isError : query.isError
  const listError = isToday ? today.error : query.error
  const isRefetching = isToday ? today.isRefetching && !today.isFetchingNextPage : query.isRefetching && !query.isFetchingNextPage
  const refresh = () => {
    if (isToday) today.refetch()
    else void query.refetch()
  }
  const loadMore = () => {
    if (isToday) {
      if (today.hasNextPage && !today.isFetchingNextPage) today.fetchNextPage()
      return
    }
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
  }
  const isSelf = surveyorId === profile.id

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

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Text variant="bodyStrong" tone="primary">
            ‹ Back
          </Text>
        </Pressable>
        <Text variant="heading">{title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => {
            const selected = f.id === filterId
            return (
              <Pressable
                key={f.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setFilterId(f.id)}
                style={[styles.filter, selected && styles.filterSelected]}
              >
                <Text variant="label" tone={selected ? "inverse" : "default"}>
                  {f.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>
      {isPending ? (
        <StatusView variant="loading" title="Loading surveys…" />
      ) : isError ? (
        <StatusView
          variant="error"
          title="Could not load surveys"
          description={getApiErrorMessage(listError)}
          actionLabel="Retry"
          onAction={refresh}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          renderItem={({ item }) => (
            <SurveyRow
              survey={item}
              unsynced={isSelf && pendingIds.has(item.id)}
              showAssignee={!surveyorId}
              onPress={() => router.push({ pathname: "/(app)/surveys/[id]", params: { id: item.id } })}
            />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refresh} />}
          ListEmptyComponent={
            <Text variant="body" tone="secondary" style={styles.empty}>
              {isToday ? "No drafts created today." : "No surveys in this list."}
            </Text>
          }
          ListFooterComponent={
            (isToday ? today.isFetchingNextPage : query.isFetchingNextPage) ? (
              <ActivityIndicator color={colors.primary} style={styles.more} />
            ) : null
          }
        />
      )}
    </Screen>
  )
}

function Separator() {
  return <View style={styles.separator} />
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
  back: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  filters: { gap: spacing.sm, paddingVertical: spacing.md },
  filter: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  list: { padding: spacing.lg, flexGrow: 1 },
  separator: { height: spacing.sm },
  empty: { textAlign: "center", marginTop: spacing.xxl },
  more: { marginVertical: spacing.lg },
})
