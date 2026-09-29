import { Screen, StatusView } from "@/components/ui"
import { useAppSession } from "@/features/auth/session/AppSessionProvider"
import { AuthError } from "@/features/auth/ui/AuthError"
import { PendingApprovalCard } from "@/features/auth/ui/PendingApprovalCard"
import { colors, radius, spacing } from "@/theme"
import type { RequestableRole } from "@/types/user"
import { Redirect } from "expo-router"
import { useState } from "react"
import { ScrollView, StyleSheet } from "react-native"

export default function PendingScreen() {
  const { state, refresh, signOut, submitRequestedRole } = useAppSession()
  const [refreshing, setRefreshing] = useState(false)
  const [submittingRole, setSubmittingRole] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)

  if (state.status === "ready") {
    return <Redirect href="/" />
  }
  if (state.status === "disabled") {
    return <Redirect href="/(app)/disabled" />
  }
  if (state.status === "signed_out") {
    return <Redirect href="/(auth)/sign-in" />
  }
  if (state.status === "booting" || state.status === "loading_profile") {
    return (
      <Screen>
        <StatusView variant="loading" title="Checking access…" />
      </Screen>
    )
  }

  if (state.status !== "pending") {
    return (
      <Screen>
        <StatusView
          variant="error"
          title="Unable to load access status"
          description={state.status === "error" ? state.message : undefined}
          actionLabel="Sign out"
          onAction={() => {
            void signOut()
          }}
        />
      </Screen>
    )
  }

  const { profile } = state

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }

  async function handleSubmitRole(role: RequestableRole) {
    setRoleError(null)
    setSubmittingRole(true)
    try {
      await submitRequestedRole(role)
    } catch (error) {
      setRoleError(error instanceof Error ? error.message : "Could not save requested role. Try again.")
    } finally {
      setSubmittingRole(false)
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <PendingApprovalCard
          fullName={profile.fullName}
          email={profile.email}
          requestedRole={profile.requestedRole}
          submittedAt={profile.createdAt}
          refreshing={refreshing}
          submittingRole={submittingRole}
          onRefresh={() => {
            void handleRefresh()
          }}
          onSignOut={() => {
            void signOut()
          }}
          onSubmitRequestedRole={profile.requestedRole ? undefined : handleSubmitRole}
        />
        {roleError ? <AuthError message={roleError} /> : null}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    padding: spacing.xl,
    justifyContent: "center",
    gap: spacing.md,
  },
})
