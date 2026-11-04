'use client'

import { Minus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Card, ErrorCard, SectionTitle, Skeleton, TestnetBadge } from '@/components/kit'
import { useAuth } from '@/lib/auth'
import { useAccountData, useNetwork } from '@/lib/hooks'
import { formatCompact, formatNumber } from '@/lib/squeek/format'
import { buildPlans, countsFromSqueeks, type LevelCounts } from '@/lib/squeek/planner'

export function PlanTab() {
  const auth = useAuth()
  const net = useNetwork()
  const account = useAccountData(auth.address)
  const network = account.data?.network ?? net.data
  const [custom, setCustom] = useState<LevelCounts | null>(null)
  const [target, setTarget] = useState(3)

  const owned = useMemo(() => (account.data ? countsFromSqueeks(account.data.squeeks) : {}), [account.data])
  const counts = custom ?? owned
  const activePower = account.data
    ? account.data.squeeks.reduce((t, s) => t + Number(s.activeWeight), 0)
    : 0

  const plans = useMemo(
    () => (network ? buildPlans(network, counts, activePower, Math.min(target, network.maximumLevel)) : []),
    [network, counts, activePower, target],
  )

  if (net.error && !network) return <ErrorCard message={net.error.message} onRetry={() => net.mutate()} />
  if (!network) return <Skeleton className="h-72" />

  const levels = Array.from({ length: network.maximumLevel }, (_, i) => i + 1)
  const setCount = (level: number, delta: number) =>
    setCustom({ ...counts, [level]: Math.max(0, Math.min(999, (counts[level] ?? 0) + delta)) })

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Upgrade planner</p>
          <TestnetBadge />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Estimates only. Based on live network power and reward rate; other miners&apos; changes will move the result. There is no
          staking: Squeeks earn automatically.
        </p>
      </Card>

      <section aria-label="Your Squeeks by level">
        <SectionTitle
          right={
            custom && (
              <button type="button" className="text-xs text-lime" onClick={() => setCustom(null)}>
                Reset to wallet
              </button>
            )
          }
        >
          {auth.connected ? 'From your wallet (editable)' : 'Squeeks by level (editable)'}
        </SectionTitle>
        <ul className="grid grid-cols-1 gap-2">
          {levels.map((level) => (
            <li key={level} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-2.5">
              <span className="text-sm">
                Level {level}
                <span className="ml-2 text-xs text-muted-foreground">
                  power {formatCompact(Number(network.levels.find((l) => l.level === level)?.weight ?? 0))}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={`Fewer level ${level} Squeeks`}
                  onClick={() => setCount(level, -1)}
                  className="flex size-8 items-center justify-center rounded-full bg-muted"
                >
                  <Minus className="size-4" aria-hidden />
                </button>
                <span className="w-6 text-center text-sm font-semibold">{counts[level] ?? 0}</span>
                <button
                  type="button"
                  aria-label={`More level ${level} Squeeks`}
                  onClick={() => setCount(level, 1)}
                  className="flex size-8 items-center justify-center rounded-full bg-muted"
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <label className="flex items-center justify-between gap-3 text-sm">
        Target level
        <select
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="h-10 rounded-xl border border-border bg-secondary px-3 text-sm"
        >
          {levels.slice(1).map((l) => (
            <option key={l} value={l}>
              Level {l}
            </option>
          ))}
        </select>
      </label>

      <section aria-label="Plans">
        <SectionTitle>Compare plans</SectionTitle>
        <ul className="flex flex-col gap-3">
          {plans.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{p.description}</p>
                  </div>
                  {p.id !== 'hold' && (
                    <Badge tone={p.deltaPerDay > 0 ? 'up' : p.deltaPerDay < 0 ? 'down' : 'muted'}>
                      {p.deltaPerDay >= 0 ? '+' : ''}
                      {formatNumber(p.deltaPerDay, 1)}/day
                    </Badge>
                  )}
                </div>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Est. SQK/day</dt>
                    <dd className="font-semibold">{formatNumber(p.sqkPerDay, 1)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Network share</dt>
                    <dd className="font-semibold">{p.sharePct < 0.01 ? '<0.01' : formatNumber(p.sharePct, 2)}%</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Squeeks / merges</dt>
                    <dd className="font-semibold">
                      {p.squeeks} / {p.merges}
                    </dd>
                  </div>
                </dl>
              </Card>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Merged power activates the round after the merge, and each merge triggers a cooldown. SQK is testnet, no real value.
        </p>
      </section>
    </div>
  )
}
