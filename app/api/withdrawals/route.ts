import { NextResponse } from 'next/server'
import { isAddress, parseUnits, verifyMessage } from 'viem'
import { CONTRACTS, TOKEN_DECIMALS, WITHDRAW_DAILY_CAP_SQK, ZERO_ADDRESS } from '@/lib/squeek/config'
import { serverClient, parseAddress } from '@/lib/server/chain'
import { ensureSchema, getSql } from '@/lib/server/db'
import { buildWithdrawalMessage } from '@/lib/squeek/withdraw'

const DAILY_CAP_WEI = parseUnits(String(WITHDRAW_DAILY_CAP_SQK), TOKEN_DECIMALS)
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000

async function usedToday(address: string) {
  const sql = getSql()!
  const rows = (await sql`
    SELECT COALESCE(SUM(amount_wei), 0)::text AS used
    FROM withdrawals
    WHERE address = ${address} AND created_at > now() - interval '24 hours'`) as { used: string }[]
  return BigInt(rows[0].used.split('.')[0])
}

/** Remaining daily allowance, so the UI can show it before the user signs anything. */
export async function GET(request: Request) {
  const address = parseAddress(new URL(request.url).searchParams.get('address'))
  if (!address) return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  if (!getSql()) return NextResponse.json({ configured: false, capSqk: WITHDRAW_DAILY_CAP_SQK })
  try {
    await ensureSchema(getSql()!)
    const used = await usedToday(address.toLowerCase())
    return NextResponse.json({
      configured: true,
      capWei: DAILY_CAP_WEI.toString(),
      usedWei: used.toString(),
      capSqk: WITHDRAW_DAILY_CAP_SQK,
    })
  } catch {
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 500 })
  }
}

/**
 * Authorizes one SQK withdrawal. The wallet still signs the on-chain transfer itself;
 * this check is the server-side gate (signature, expiry, balance, daily cap, new recipient).
 */
export async function POST(request: Request) {
  const sql = getSql()
  if (!sql) {
    return NextResponse.json(
      { code: 'not_configured', error: 'Withdrawals are disabled until DATABASE_URL is configured.' },
      { status: 503 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { address, to, amount, nonce, expiresAt, signature, confirmNewAddress } = body as {
    address: string
    to: string
    amount: string
    nonce: string
    expiresAt: number
    signature: `0x${string}`
    confirmNewAddress?: boolean
  }

  if (!isAddress(address) || !isAddress(to) || typeof nonce !== 'string' || nonce.length < 8 || nonce.length > 80) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (to.toLowerCase() === ZERO_ADDRESS || to.toLowerCase() === CONTRACTS.token.address.toLowerCase()) {
    return NextResponse.json({ code: 'bad_recipient', error: 'That recipient is not allowed.' }, { status: 400 })
  }

  let amountWei: bigint
  try {
    amountWei = parseUnits(String(amount), TOKEN_DECIMALS)
  } catch {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }
  if (amountWei <= 0n) return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })

  const now = Date.now()
  if (typeof expiresAt !== 'number' || expiresAt < now || expiresAt - now > MAX_SIGNATURE_AGE_MS) {
    return NextResponse.json({ code: 'expired', error: 'Signature expired. Try again.' }, { status: 400 })
  }

  const valid = await verifyMessage({
    address,
    message: buildWithdrawalMessage({ address, to, amount: String(amount), nonce, expiresAt }),
    signature,
  }).catch(() => false)
  if (!valid) return NextResponse.json({ code: 'bad_signature', error: 'Signature check failed.' }, { status: 401 })

  try {
    await ensureSchema(sql)
    const owner = address.toLowerCase()
    const recipient = to.toLowerCase()

    const balance = (await serverClient.readContract({
      address: CONTRACTS.token.address,
      abi: CONTRACTS.token.abi,
      functionName: 'balanceOf',
      args: [address],
    })) as bigint
    if (amountWei > balance) {
      return NextResponse.json({ code: 'insufficient', error: 'Amount exceeds your SQK balance.' }, { status: 400 })
    }

    const used = await usedToday(owner)
    if (used + amountWei > DAILY_CAP_WEI) {
      return NextResponse.json(
        {
          code: 'daily_cap',
          error: `Daily cap of ${WITHDRAW_DAILY_CAP_SQK} SQK would be exceeded.`,
          usedWei: used.toString(),
          capWei: DAILY_CAP_WEI.toString(),
        },
        { status: 403 },
      )
    }

    const known = (await sql`
      SELECT 1 FROM known_recipients WHERE address = ${owner} AND recipient = ${recipient} LIMIT 1`) as unknown[]
    if (known.length === 0 && confirmNewAddress !== true) {
      return NextResponse.json(
        { code: 'new_address', error: 'First time sending to this address. Confirm it is correct.' },
        { status: 409 },
      )
    }

    await sql`
      INSERT INTO withdrawals (address, to_address, amount_wei, nonce)
      VALUES (${owner}, ${recipient}, ${amountWei.toString()}, ${nonce})`
    await sql`
      INSERT INTO known_recipients (address, recipient) VALUES (${owner}, ${recipient})
      ON CONFLICT DO NOTHING`

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('withdrawals_nonce_key')) {
      return NextResponse.json({ code: 'replay', error: 'That request was already used.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not authorize withdrawal.' }, { status: 500 })
  }
}
