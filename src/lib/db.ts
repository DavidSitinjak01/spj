import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Resolve DATABASE_URL — system env may override .env with a stale SQLite path.
// We read .env directly as fallback when the env var points to SQLite.
let databaseUrl = process.env.DATABASE_URL || ''
if (databaseUrl.startsWith('file:') || !databaseUrl.startsWith('postgresql://')) {
  // System DATABASE_URL is SQLite or invalid — try reading from .env file
  try {
    const envPath = path.join(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8')
      const match = envContent.match(/^DATABASE_URL=(.+)$/m)
      if (match && match[1].trim().startsWith('postgresql://')) {
        databaseUrl = match[1].trim()
        console.log('[db] Overrode stale DATABASE_URL with value from .env file')
      }
    }
  } catch {
    // Failed to read .env, continue with whatever we have
  }
}

// For Neon PostgreSQL with PgBouncer pooler, we need to disable prepared statements
// to avoid "cached plan must not change result type" errors after schema changes.
// Adding pgbouncer=true tells Prisma to not use prepared statements.
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
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
