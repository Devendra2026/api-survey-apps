import { PrismaPg } from "@prisma/adapter-pg"
import { loadRootEnv } from "../load-root-env.js"
import { PrismaClient } from "../src/generated/prisma/client.js"
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

async function main() {
  const { roles, geo } = await seedCatalog(prisma)

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
