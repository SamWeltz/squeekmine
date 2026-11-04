import { NextResponse } from 'next/server'
import { parseAddress, readAccount } from '@/lib/server/chain'
import { ensureSchema, getSql } from '@/lib/server/db'
import { squeekPower } from '@/lib/server/power'

export const maxDuration = 60

export async function GET(request: Request) {
  const address = parseAddress(new URL(request.url).searchParams.get('address'))
  if (!address) return NextResponse.json({ error: 'Invalid address' }, { status: 400 })

  try {
    const data = await readAccount(address)

    const sql = getSql()
    if (sql) {
      try {
        await ensureSchema(sql)
        const wallet = BigInt(data.sqkBalance).toString()
        const unclaimed = BigInt(data.unclaimed).toString()
        await sql`
          INSERT INTO snapshots (address, squeeks, power, sqk_wallet, sqk_unclaimed)
          SELECT ${address.toLowerCase()}, ${data.squeeks.length}, ${squeekPower(data.squeeks)}, ${wallet}, ${unclaimed}
          WHERE NOT EXISTS (
            SELECT 1 FROM snapshots
            WHERE address = ${address.toLowerCase()} AND taken_at > now() - interval '55 minutes'
          )`
      } catch (e) {
        console.log('[v0] snapshot write failed:', e instanceof Error ? e.message : e)
      }
    }

    return NextResponse.json(data)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Chain read failed'
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 502 })
  }
}
