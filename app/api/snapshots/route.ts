import { NextResponse } from 'next/server'
import { parseAddress } from '@/lib/server/chain'
import { ensureSchema, getSql } from '@/lib/server/db'

const RANGES: Record<string, string> = {
  '1W': '7 days',
  '1M': '30 days',
  '3M': '90 days',
  '6M': '180 days',
  '1Y': '365 days',
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const address = parseAddress(params.get('address'))
  if (!address) return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  const interval = RANGES[params.get('range') ?? '1M'] ?? RANGES['1M']

  const sql = getSql()
  if (!sql) return NextResponse.json({ configured: false, points: [] })

  try {
    await ensureSchema(sql)
    const rows = (await sql`
      SELECT extract(epoch from taken_at)::bigint AS t,
             ((sqk_wallet + sqk_unclaimed) / 1e18)::float8 AS v,
             squeeks
      FROM snapshots
      WHERE address = ${address.toLowerCase()}
        AND taken_at > now() - ${interval}::interval
      ORDER BY taken_at ASC`) as { t: string; v: number; squeeks: number }[]

    const step = Math.max(1, Math.ceil(rows.length / 120))
    const points = rows
      .filter((_, i) => i % step === 0 || i === rows.length - 1)
      .map((r) => ({ t: Number(r.t), v: r.v, squeeks: r.squeeks }))
    return NextResponse.json({ configured: true, points })
  } catch (e) {
    return NextResponse.json(
      { configured: true, points: [], error: e instanceof Error ? e.message.slice(0, 200) : 'Query failed' },
      { status: 500 },
    )
  }
}
