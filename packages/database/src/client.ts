import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { PrismaClient } from "./generated/prisma/client.js"

/**
 * Explicit pool budget for one Node process.
 * Postgres 17 defaults to max_connections=100. API and worker each keep a small pool
 * so survey traffic, jobs, migrate, and an admin session fit without raising that limit.
 */
export type PrismaPoolOptions = {
  max: number
  connectionTimeoutMillis: number
  idleTimeoutMillis: number
  applicationName: string
  statementTimeoutMillis?: number
  queryTimeoutMillis?: number
  idleInTransactionTimeoutMillis?: number
}

export type CreatePrismaClientOptions = {
  connectionString?: string
  pool?: PrismaPoolOptions
}

export function createPrismaClient(options: CreatePrismaClientOptions = {}): PrismaClient {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }
  const adapter = new PrismaPg(options.pool ? poolConfig(connectionString, options.pool) : connectionString)
  return new PrismaClient({ adapter })
}

function poolConfig(connectionString: string, pool: PrismaPoolOptions): pg.PoolConfig {
  return {
    connectionString,
    max: pool.max,
    connectionTimeoutMillis: pool.connectionTimeoutMillis,
    idleTimeoutMillis: pool.idleTimeoutMillis,
    application_name: pool.applicationName,
    ...(pool.statementTimeoutMillis !== undefined ? { statement_timeout: pool.statementTimeoutMillis } : {}),
    ...(pool.queryTimeoutMillis !== undefined ? { query_timeout: pool.queryTimeoutMillis } : {}),
    ...(pool.idleInTransactionTimeoutMillis !== undefined
      ? { idle_in_transaction_session_timeout: pool.idleInTransactionTimeoutMillis }
      : {}),
  } as pg.PoolConfig
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

/** Lazy singleton — does not require DATABASE_URL until first use. */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === "function" ? value.bind(client) : value
  },
})
