'use client'

import { ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import useSWR from 'swr'
import { isAddress, parseUnits } from 'viem'
import { useSignMessage } from 'wagmi'
import { Btn, TestnetBadge } from '@/components/kit'
import { Sheet } from '@/components/sheet'
import { useAuth } from '@/lib/auth'
import { useAccountData } from '@/lib/hooks'
import { transferSqkRequest } from '@/lib/squeek/actions'
import { TOKEN_DECIMALS } from '@/lib/squeek/config'
import { formatSqk } from '@/lib/squeek/format'
import { buildWithdrawalMessage } from '@/lib/squeek/withdraw'
import { useUI } from '@/lib/ui-context'

type Limits = { configured: boolean; capWei?: string; usedWei?: string; capSqk: number }

const limitsFetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<Limits>)

export function WithdrawSheet() {
  const { closeSheet, openSheet } = useUI()
  const { address } = useAuth()
  const { data: account } = useAccountData(address)
  const { data: limits } = useSWR(address ? `/api/withdrawals?address=${address}` : null, limitsFetcher)
  const { signMessageAsync } = useSignMessage()

  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const balance = account ? BigInt(account.sqkBalance) : 0n
  let amountWei = 0n
  try {
    amountWei = amount ? parseUnits(amount, TOKEN_DECIMALS) : 0n
  } catch {
    amountWei = 0n
  }
  const validTo = isAddress(to)
  const valid = validTo && amountWei > 0n && amountWei <= balance
  const remaining = limits?.configured && limits.capWei && limits.usedWei ? BigInt(limits.capWei) - BigInt(limits.usedWei) : null

  async function submit() {
    if (!address || !valid) return
    setBusy(true)
    setError(null)
    try {
      const req = {
        address,
        to,
        amount,
        nonce: crypto.randomUUID(),
        expiresAt: Date.now() + 4 * 60 * 1000,
      }
      const signature = await signMessageAsync({ message: buildWithdrawalMessage(req) })
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...req, signature, confirmNewAddress: confirmed }),
      })
      const json = await res.json()
      if (res.status === 409 && json.code === 'new_address') {
        setNeedsConfirm(true)
        setError(json.error)
        return
      }
      if (!res.ok) {
        setError(json.error ?? 'Withdrawal was not authorized.')
        return
      }
      openSheet({ type: 'tx', tx: transferSqkRequest(to as `0x${string}`, amount) })
    } catch (e) {
      setError(e instanceof Error ? e.message.slice(0, 160) : 'Signature was rejected.')
    } finally {
      setBusy(false)
    }
  }

  const disabledReason = limits && !limits.configured

  return (
    <Sheet title="Withdraw SQK" onClose={closeSheet}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <TestnetBadge />
          <span className="text-xs text-muted-foreground">Testnet SQK has no real value.</span>
        </div>

        {disabledReason && (
          <p role="alert" className="rounded-xl bg-warn/10 p-3 text-xs leading-relaxed text-warn">
            Withdrawals are switched off until the server-side limits store (DATABASE_URL) is configured.
          </p>
        )}

        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          Recipient address
          <input
            value={to}
            onChange={(e) => {
              setTo(e.target.value.trim())
              setNeedsConfirm(false)
              setConfirmed(false)
            }}
            placeholder="0x..."
            spellCheck={false}
            autoComplete="off"
            className="h-12 rounded-xl border border-border bg-secondary px-3 font-mono text-sm text-foreground outline-none focus-visible:border-lime"
          />
        </label>
        {to && !validTo && <p className="-mt-2 text-xs text-down">Not a valid address.</p>}

        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          <span className="flex justify-between">
            Amount (SQK)
            <button type="button" className="text-lime" onClick={() => setAmount(formatSqk(balance, 4).replaceAll(',', ''))}>
              Max {formatSqk(balance, 2)}
            </button>
          </span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            inputMode="decimal"
            placeholder="0.0"
            className="h-12 rounded-xl border border-border bg-secondary px-3 text-sm text-foreground outline-none focus-visible:border-lime"
          />
        </label>
        {amountWei > balance && <p className="-mt-2 text-xs text-down">More than your wallet balance.</p>}

        {limits?.configured && (
          <p className="text-xs text-muted-foreground">
            Daily limit {limits.capSqk.toLocaleString()} SQK.
            {remaining !== null && ` ${formatSqk(remaining < 0n ? 0n : remaining, 0)} SQK left today.`}
          </p>
        )}

        {needsConfirm && (
          <label className="flex items-start gap-3 rounded-xl border border-warn/40 bg-warn/10 p-3 text-xs leading-relaxed text-warn">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="flex-1">
              First time sending to this address. Double-check every character.
              <span className="mt-2 flex items-center gap-2 font-semibold">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="size-4 accent-[#c8ff3d]" />
                I verified this address
              </span>
            </span>
          </label>
        )}

        {error && !needsConfirm && (
          <p role="alert" className="text-xs text-down">
            {error}
          </p>
        )}

        <Btn onClick={submit} loading={busy} disabled={!valid || disabledReason || (needsConfirm && !confirmed)}>
          {needsConfirm ? 'Sign again and continue' : 'Sign request and review'}
        </Btn>
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Step 1: sign a message so the server can check limits. Step 2: review and sign the transfer in your wallet.
        </p>
      </div>
    </Sheet>
  )
}
