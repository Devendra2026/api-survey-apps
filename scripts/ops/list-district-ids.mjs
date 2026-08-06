#!/usr/bin/env node
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(resolve(__dirname, "../../packages/database/package.json"))
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()
try {
  const rows = await prisma.district.findMany({
    where: {
      OR: [
        { name: { contains: "Bagh", mode: "insensitive" } },
        { name: { contains: "Bhag", mode: "insensitive" } },
        { name: { contains: "Etah", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  })
  console.log(JSON.stringify(rows, null, 2))
} finally {
  await prisma.$disconnect()
}
