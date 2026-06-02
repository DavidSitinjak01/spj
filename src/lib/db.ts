import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// For Neon PostgreSQL with PgBouncer pooler, we need to disable prepared statements
// to avoid "cached plan must not change result type" errors after schema changes.
// Adding pgbouncer=true tells Prisma to not use prepared statements.
let databaseUrl = process.env.DATABASE_URL || ''
if (databaseUrl.includes('neon.tech') || databaseUrl.includes('neondb')) {
  // Add pgbouncer=true for Neon connections if not already present
  if (!databaseUrl.includes('pgbouncer=true')) {
    databaseUrl += (databaseUrl.includes('?') ? '&' : '?') + 'pgbouncer=true&connect_timeout=30'
  }
  // Also need to use non-pooler for schema push operations, but for runtime queries
  // pgbouncer=true is the correct setting
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
