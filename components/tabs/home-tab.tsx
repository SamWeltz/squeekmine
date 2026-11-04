'use client'

import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { useState } from 'react'
import { ActivityList } from '@/components/activity-list'
import { Badge, Btn, Card, ErrorCard, SectionTitle, Skeleton, TestnetBadge } from '@/components/kit'
import { ValueChart } from '@/components/value-chart'
import { useAuth } from '@/lib/auth'
import { useAccountData, useNetwork } from '@/lib/hooks'
import { formatCompact, formatNumber, formatSqk, sqkToNumber } from '@/lib/squeek/format'
import { useUI } from '@/lib/ui-context'
import { cn } from '@/lib/utils'

const RANGES = ['1W', '1M', '3M', '6M', '1Y'] as const

function Split({ label, a, b, aLabel, bLabel }: { label: string; a: number; b: number; aLabel: string; bLabel: string }) {
  const total = a + b
  const pct = total > 0 ? (a / total) * 100 : 0
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">{label}</p>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${aLabel} ${pct.toFixed(0)} percent`}>
        <div className="bg-lime" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs">
        <span>
          <span className="mr-1.5 inline-block size-2 rounded-full bg-lime" aria-hidden />
          {aLabel}
        </span>
        <span className="text-muted-foreground">{bLabel}</span>
      </div>
    </div>
  )
}

function NetworkCard() {
  const { data, error, mutate } = useNetwork()
  if (error) return <ErrorCard message={error.message} onRetry={() => mutate()} />
  if (!data) return <Skeleton className="h-40" />
  const reward = sqkToNumber(data.rewardPerBlock)
  const minted = sqkToNumber(data.minted)
  const cap = sqkToNumber(data.supplyCap)
  return (
    <Card>
      <SectionTitle right={<TestnetBadge />}>Network</SectionTitle>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Reward per block</dt>
          <dd className="mt-0.5 font-semibold">{formatNumber(reward, 0)} SQK</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Blocks per day (est.)</dt>
          <dd className="mt-0.5 font-semibold">{formatNumber(data.blocksPerDay, 1)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Total mining power</dt>
          <dd className="mt-0.5 font-semibold">{formatCompact(Number(data.totalWeight))}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Minted / cap</dt>
          <dd className="mt-0.5 font-semibold">
            {formatCompact(minted)} / {formatCompact(cap)}
          </dd>
        </div>
      </dl>
    </Card>
  )
}

export function HomeTab() {
  const auth = useAuth()
  const { openSheet, setTab } = useUI()
  const { data, error, isLoading, mutate } = useAccountData(auth.address)
  const [range, setRange] = useState<(typeof RANGES)[number]>('1M')

  if (!auth.connected) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col items-start gap-4 p-6">
          <TestnetBadge />
          <h1 className="text-balance text-2xl font-bold leading-tight">Your Squeeks, in one place.</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            See your mining position, claim SQK, merge Squeeks and plan upgrades on the Sepolia testnet. Non-custodial: you
            sign everything in your own wallet.
          </p>
          <Btn onClick={() => openSheet({ type: 'auth' })}>Sign in</Btn>
        </Card>
        <NetworkCard />
        <Card className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Try the planner without a wallet.</p>
          <Btn variant="secondary" size="sm" onClick={() => setTab('plan')}>
            Open planner
          </Btn>
        </Card>
      </div>
    )
  }

  if (error && !data) return <ErrorCard message={error.message} onRetry={() => mutate()} />
  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-52" />
        <Skeleton className="h-32" />
      </div>
    )
  }

  const wallet = sqkToNumber(data.sqkBalance)
  const unclaimed = sqkToNumber(data.unclaimed)
  const total = wallet + unclaimed
  const active = data.squeeks.reduce((t, s) => t + Number(s.activeWeight), 0)
  const pending = data.squeeks.reduce((t, s) => t + Number(s.pendingWeight), 0)
  const ethBalance = Number(data.ethBalance) / 1e18

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Total SQK (wallet + unclaimed)</p>
          <TestnetBadge />
        </div>
        <p className="mt-1 text-4xl font-bold tracking-tight">
          {formatNumber(total, 2)} <span className="text-lg font-semibold text-muted-foreground">SQK</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {data.squeeks.length} Squeek{data.squeeks.length === 1 ? '' : 's'}. Testnet tokens, no real value.
        </p>

        <ValueChart address={data.address} range={range} />

        <div className="mt-3 flex justify-between" role="tablist" aria-label="Chart range">
          {RANGES.map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold',
                range === r ? 'bg-lime text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Btn variant="secondary" onClick={() => openSheet({ type: 'receive' })}>
            <ArrowDownToLine className="size-4" aria-hidden /> Receive
          </Btn>
          <Btn onClick={() => openSheet({ type: 'withdraw' })}>
            <ArrowUpFromLine className="size-4" aria-hidden /> Withdraw
          </Btn>
        </div>
      </Card>

      <Card className="flex flex-col gap-5">
        <SectionTitle>Allocation</SectionTitle>
        <Split
          label="Mining power"
          a={active}
          b={pending}
          aLabel={`${formatCompact(active)} earning`}
          bLabel={`${formatCompact(pending)} activating`}
        />
        <Split
          label="SQK"
          a={unclaimed}
          b={wallet}
          aLabel={`${formatNumber(unclaimed, 2)} unclaimed in mining`}
          bLabel={`${formatNumber(wallet, 2)} in wallet`}
        />
        <div className="flex items-center justify-between border-t border-border pt-4 text-xs">
          <span className="text-muted-foreground">Sepolia ETH for fees</span>
          <span className="flex items-center gap-2 font-semibold">
            {formatNumber(ethBalance, 4)} ETH
            {ethBalance < 0.001 && <Badge tone="warn">Low, use a faucet</Badge>}
          </span>
        </div>
      </Card>

      {BigInt(data.unclaimed) > 0n && (
        <Card className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{formatSqk(data.unclaimed, 4)} SQK ready</p>
            <p className="text-xs text-muted-foreground">Unclaimed testnet rewards</p>
          </div>
          <Btn size="sm" onClick={() => setTab('squeeks')}>
            Claim
          </Btn>
        </Card>
      )}

      <section aria-label="Recent activity">
        <SectionTitle>Activity</SectionTitle>
        <ActivityList items={data.activity} />
      </section>
    </div>
  )
}
