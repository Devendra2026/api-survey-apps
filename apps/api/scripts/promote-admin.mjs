import { createPrismaClient, promoteClerkUserToAdmin } from "@workspace/database"

/**
 * @param {string[]} args
 * @returns {string}
 */
function readClerkUserId(args) {
  const flagIndex = args.indexOf("--clerk-user-id")
  const value = flagIndex === -1 ? undefined : args[flagIndex + 1]
  if (!value || value.startsWith("--")) {
    throw new Error("Usage: pnpm --filter api promote-admin -- --clerk-user-id <id>")
  }
  return value
}

async function main() {
  const clerkUserId = readClerkUserId(process.argv.slice(2))
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL or DIRECT_URL must be set")
  }

  const prisma = createPrismaClient({ connectionString })
  try {
    const result = await promoteClerkUserToAdmin(prisma, clerkUserId)
    if (result.status === "user-not-found") {
      throw new Error(`No user found for clerkUserId=${clerkUserId}`)
    }
    if (result.status === "admin-role-not-found") {
      throw new Error("ADMIN role not found; run the database seed first")
    }

    console.log(
      result.status === "already-admin"
        ? `User ${clerkUserId} is already an active ADMIN`
        : `Promoted ${clerkUserId} to ADMIN`
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
