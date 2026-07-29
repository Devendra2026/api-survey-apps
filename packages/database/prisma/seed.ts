import { PrismaPg } from "@prisma/adapter-pg"
import { loadRootEnv } from "../load-root-env.js"
import { PrismaClient } from "../src/generated/prisma/client.js"
import { promoteUserToAdmin } from "../src/role-promotion.js"
import { seedCatalog } from "./seed-catalog.js"
import { seedDemo } from "./seed-demo.js"

loadRootEnv(import.meta.url)

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL is not set")
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
})

function shouldSeedDemo(): boolean {
  if (process.env.SEED_DEMO === "false") {
    return false
  }
  if (process.env.SEED_DEMO === "true") {
    return true
  }
  return process.env.NODE_ENV === "development"
}

function resolveBootstrapAdminClerkUserId(): string | undefined {
  const fromSeed = process.env.SEED_ADMIN_CLERK_USER_ID?.trim()
  if (fromSeed) return fromSeed

  const fromBootstrap = process.env.BOOTSTRAP_ADMIN_CLERK_USER_IDS?.split(",")
    .map((id) => id.trim())
    .find(Boolean)
  return fromBootstrap
}

async function seedBootstrapAdmin(
  db: PrismaClient,
  roles: Record<string, { id: string; name: string }>
): Promise<void> {
  const clerkUserId = resolveBootstrapAdminClerkUserId()
  if (!clerkUserId) {
    console.log("No SEED_ADMIN_CLERK_USER_ID / BOOTSTRAP_ADMIN_CLERK_USER_IDS — skipping bootstrap admin user")
    return
  }

  const adminRole = roles.ADMIN
  if (!adminRole) {
    throw new Error("ADMIN role missing after catalog seed")
  }

  const user = await db.user.upsert({
    where: { clerkUserId },
    create: {
      clerkUserId,
      email: `${clerkUserId}@clerk.local`,
      fullName: "Bootstrap Admin",
      isActive: true,
    },
    update: {
      isActive: true,
    },
  })

  const result = await promoteUserToAdmin(db, user.id)
  if (result.status === "admin-role-not-found") {
    throw new Error("ADMIN role not found while promoting bootstrap admin")
  }

  console.log(
    result.status === "already-admin"
      ? `Bootstrap admin already ADMIN clerkUserId=${clerkUserId}`
      : `Seeded bootstrap admin clerkUserId=${clerkUserId} as global ADMIN`
  )
}

async function main() {
  const { roles, geo } = await seedCatalog(prisma)
  await seedBootstrapAdmin(prisma, roles)

  if (shouldSeedDemo()) {
    console.log("Seeding demo data (users + sample surveys)")
    await seedDemo(prisma, geo, roles)
  } else {
    console.log("Skipping demo seed (set SEED_DEMO=true or NODE_ENV=development to enable)")
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
