import { neon } from '@neondatabase/serverless'

type Sql = ReturnType<typeof neon>

let schemaReady: Promise<void> | null = null

export function getSql(): Sql | null {
  const url = process.env.DATABASE_URL
  if (!url) return null
  return neon(url)
}

export async function ensureSchema(sql: Sql): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS snapshots (
        address text NOT NULL,
        taken_at timestamptz NOT NULL DEFAULT now(),
        squeeks integer NOT NULL,
        power numeric NOT NULL,
        sqk_wallet numeric NOT NULL,
        sqk_unclaimed numeric NOT NULL,
        PRIMARY KEY (address, taken_at)
      )`
      await sql`CREATE TABLE IF NOT EXISTS withdrawals (
        id bigserial PRIMARY KEY,
        address text NOT NULL,
        to_address text NOT NULL,
        amount_wei numeric NOT NULL,
        nonce text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      )`
      await sql`CREATE TABLE IF NOT EXISTS known_recipients (
        address text NOT NULL,
        recipient text NOT NULL,
        first_seen timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (address, recipient)
      )`
    })().catch((e) => {
      schemaReady = null
      throw e
    })
  }
  return schemaReady
}
