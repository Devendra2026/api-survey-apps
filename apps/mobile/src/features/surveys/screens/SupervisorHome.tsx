import { Button, Screen, Text, cardStyle } from "@/components/ui"
import { getApiErrorMessage } from "@/services/api/client"
import { colors, spacing } from "@/theme"
import type { AuthenticatedProfile } from "@/types/user"
import { useRouter } from "expo-router"
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native"
import { useFieldMetrics } from "../hooks/queries"
import { MetricTile, Pill } from "../ui/primitives"
import type { ListFilterId } from "./SurveyListScreen"

function relativeTime(iso: string | null): string {
  if (!iso) return "No activity yet"
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return "Active just now"
  if (minutes < 60) return `Active ${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Active ${hours} h ago`
  return `Last active ${new Date(iso).toLocaleDateString()}`
}

/**
 * Read-only team progress for FIELD_SUPERVISOR / QC_SUPERVISOR. Every number comes from
 * `GET /surveys/field-metrics?scope=team`, which the API scopes to the caller's tenant roles.
 */
export function SupervisorHome({
  profile,
  role,
  onSignOut,
}: {
  profile: AuthenticatedProfile
  role: "FIELD_SUPERVISOR" | "QC_SUPERVISOR"
  onSignOut: () => void
}) {
  const router = useRouter()
  const metrics = useFieldMetrics("team")
  const data = metrics.data
  const t = data?.totals

  const openList = (filter: ListFilterId, surveyorId?: string, title?: string) =>
    router.push({
      pathname: "/(app)/surveys/list",
      params: { filter, ...(surveyorId ? { surveyorId } : {}), ...(title ? { title } : {}) },
    })

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={metrics.isRefetching} onRefresh={() => void metrics.refetch()} />}
      >
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text variant="caption" tone="secondary">
              {role === "QC_SUPERVISOR" ? "QC supervisor" : "Supervisor"}
            </Text>
            <Text variant="title" numberOfLines={1}>
              {profile.fullName}
            </Text>
          </View>
          <Button title="Sign out" variant="ghost" onPress={onSignOut} />
        </View>

        {metrics.isPending ? (
          <ActivityIndicator color={colors.primary} />
        ) : metrics.isError ? (
          <View style={[cardStyle, styles.gap]}>
            <Text variant="caption" tone="danger">
              {getApiErrorMessage(metrics.error, "Could not load team progress")}
            </Text>
            <Button title="Retry" variant="secondary" onPress={() => void metrics.refetch()} />
          </View>
        ) : data && t ? (
          <>
            <View style={[cardStyle, styles.team]}>
              <Stat label="Assigned surveyors" value={data.assignedSurveyorCount ?? 0} />
              <Stat label="Active today" value={data.activeSurveyorCount ?? 0} />
              <Stat label="Submitted today" value={t.submittedToday} />
            </View>

            <Text variant="label" tone="secondary" style={styles.sectionLabel}>
              Team surveys
            </Text>
            <View style={styles.tiles}>
              <Tile onPress={() => openList("inProgress")} label="Drafts" value={t.fieldDraft} />
              <Tile onPress={() => openList("underQc")} label="Under QC" value={t.pendingQc} tone="progress" />
              <Tile onPress={() => openList("returned")} label="Needs correction" value={t.returned + t.rework} tone="danger" />
              <Tile onPress={() => openList("approved")} label="Approved" value={t.approved} tone="success" />
            </View>
            <Text variant="caption" tone="secondary" style={styles.note}>
              {t.createdToday} created today · {t.resubmitted} resubmitted after correction · {t.total} total
            </Text>

            <Text variant="label" tone="secondary" style={styles.sectionLabel}>
              Surveyors
            </Text>
            {data.surveyors.length === 0 ? (
              <Text variant="caption" tone="secondary">
                No surveyors are assigned in your area yet.
              </Text>
            ) : (
              <View style={styles.gap}>
                {data.surveyors.map((s) => {
                  const active = data.activeSurveyorCount !== null && s.lastActivityAt !== null && s.lastActivityAt >= data.todayStart
                  return (
                    <Pressable
                      key={s.userId}
                      accessibilityRole="button"
                      accessibilityLabel={`${s.fullName} surveys`}
                      onPress={() => openList("all", s.userId, s.fullName)}
                      style={({ pressed }) => [cardStyle, styles.surveyor, pressed && styles.pressed]}
                    >
                      <View style={styles.surveyorTop}>
                        <View style={styles.flex}>
                          <Text variant="bodyStrong">{s.fullName}</Text>
                          <Text variant="caption" tone="secondary" numberOfLines={1}>
                            {s.wards.length ? `Wards ${s.wards.join(", ")}` : "No ward on record"}
                          </Text>
                        </View>
                        <Pill label={active ? "Active today" : "Idle"} tone={active ? "success" : "neutral"} />
                      </View>
                      <Text variant="caption" tone="secondary">
                        {s.totals.fieldDraft} draft · {s.totals.pendingQc} under QC · {s.totals.returned + s.totals.rework} to fix ·{" "}
                        {s.totals.approved} approved
                      </Text>
                      <Text variant="caption" tone="secondary">
                        Today: {s.createdToday} created · {s.submittedToday} submitted · {relativeTime(s.lastActivityAt)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            )}

            {data.wards.length > 0 ? (
              <>
                <Text variant="label" tone="secondary" style={styles.sectionLabel}>
                  By ward
                </Text>
                <View style={styles.gap}>
                  {data.wards.map((w) => (
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
                        {w.totals.pendingQc} QC · {w.totals.returned + w.totals.rework} fix · {w.totals.approved} ok
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text variant="heading">{value}</Text>
      <Text variant="caption" tone="secondary" style={styles.center}>
        {label}
      </Text>
    </View>
  )
}

function Tile({
  label,
  value,
  tone,
  onPress,
}: {
  label: string
  value: number
  tone?: "progress" | "danger" | "success"
  onPress: () => void
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.tile}>
      <MetricTile label={label} value={value} tone={tone} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  flex: { flex: 1 },
  team: { flexDirection: "row", justifyContent: "space-between", padding: spacing.lg },
  stat: { flex: 1, alignItems: "center" },
  center: { textAlign: "center" },
  sectionLabel: { marginTop: spacing.xl, marginBottom: spacing.sm },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  tile: { flexGrow: 1, flexBasis: "45%" },
  note: { marginTop: spacing.sm },
  gap: { gap: spacing.sm },
  surveyor: { gap: spacing.xs, padding: spacing.lg },
  surveyorTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pressed: { backgroundColor: colors.surfaceMuted },
  wardRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
})
