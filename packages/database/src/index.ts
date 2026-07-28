export { createPrismaClient, getPrisma, prisma } from "./client.js"
export type { CreatePrismaClientOptions } from "./client.js"
export { promoteClerkUserToAdmin, promoteUserToAdmin } from "./role-promotion.js"
export type { AdminPromotionResult } from "./role-promotion.js"

export * from "./generated/prisma/client.js"
