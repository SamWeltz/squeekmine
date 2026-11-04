import { NextResponse } from 'next/server'
import { readNetwork } from '@/lib/server/chain'

export async function GET() {
  try {
    return NextResponse.json(await readNetwork())
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Chain read failed'
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 502 })
  }
}
