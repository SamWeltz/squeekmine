'use client'

import { useState } from 'react'
import { Badge, Btn, Card, EmptyState, ErrorCard, SectionTitle, Skeleton, SqueekAvatar } from '@/components/kit'
import { ConnectPrompt } from '@/components/connect-prompt'
import { useAuth } from '@/lib/auth'
import { useAccountData } from '@/lib/hooks'
import { mergeRequest } from '@/lib/squeek/actions'
import { blocksToDuration, formatSqk } from '@/lib/squeek/format'
import { mergeState, weightOf } from '@/lib/squeek/planner'
import { useUI } from '@/lib/ui-context'
import { cn } from '@/lib/utils'

export function MergeTab() {
  const auth = useAuth()
  const { openSheet } = useUI()
  const { data, error, isLoading, mutate } = useAccountData(auth.address)
  const [picked, setPicked] = useState<string[]>([])

  if (!auth.connected) return <ConnectPrompt what="merge Squeeks" />
  if (error && !data) return <ErrorCard message={error.message} onRetry={() => mutate()} />
  if (isLoading || !data) return <Skeleton className="h-64" />

  const { network, squeeks } = data
  const states = new Map(squeeks.map((s) => [s.tokenId, mergeState(s, network.completedBlocks, network.maximumLevel)]))
  const byId = new Map(squeeks.map((s) => [s.tokenId, s]))
  const ready = squeeks.filter((s) => states.get(s.tokenId)?.state === 'ready')
  const other = squeeks.filter((s) => states.get(s.tokenId)?.state !== 'ready')

  function toggle(id: string) {
    const s = byId.get(id)!
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      const sameLevel = prev.filter((p) => byId.get(p)?.level === s.level)
      return [...sameLevel, id].slice(-2)
    })
  }

  const survivor = picked[0] ? byId.get(picked[0]) : undefined
  const donor = picked[1] ? byId.get(picked[1]) : undefined

  function review() {
    if (!survivor || !donor) return
    const tx = mergeRequest(survivor, donor, network)
    if (BigInt(donor.claimable) > 0n) {
      tx.warnings = [
        `Squeek #${donor.tokenId} has ${formatSqk(donor.claimable, 4)} SQK unclaimed. Claim it first, a burned Squeek cannot be claimed afterwards.`,
        ...(tx.warnings ?? []),
      ]
    }
    openSheet({ type: 'tx', tx })
  }

  if (squeeks.length < 2) {
    return <EmptyState title="Need two Squeeks" body="Merging combines two Squeeks of the same level into one at the next level." />
  }

  const outcome = survivor ? weightOf(network, survivor.level + 1) : 0

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Pick two Squeeks of the same level. The first you pick is kept and levels up, the second is{' '}
          <span className="font-semibold text-foreground">burned permanently</span>. New power starts earning from the next round.
        </p>
      </Card>

      <section aria-label="Squeeks ready to merge">
        <SectionTitle>Ready to merge ({ready.length})</SectionTitle>
        {ready.length === 0 ? (
          <EmptyState title="Nothing ready" body="Squeeks need to finish activating and any merge cooldown before they can merge." />
        ) : (
          <ul className="flex flex-col gap-2">
            {ready.map((s) => {
              const idx = picked.indexOf(s.tokenId)
              return (
                <li key={s.tokenId}>
                  <button
                    type="button"
                    onClick={() => toggle(s.tokenId)}
                    aria-pressed={idx >= 0}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors',
                      idx >= 0 ? 'border-lime' : 'border-border',
                    )}
                  >
                    <SqueekAvatar tokenId={s.tokenId} className="size-10" />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">Squeek #{s.tokenId}</span>
                      <span className="block text-xs text-muted-foreground">Level {s.level}</span>
                    </span>
                    {idx === 0 && <Badge tone="lime">Keep</Badge>}
                    {idx === 1 && <Badge tone="down">Burn</Badge>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {other.length > 0 && (
        <section aria-label="Squeeks not ready">
          <SectionTitle>Not ready</SectionTitle>
          <ul className="flex flex-col gap-2">
            {other.map((s) => {
              const st = states.get(s.tokenId)!
              return (
                <li key={s.tokenId} className="flex items-center gap-3 rounded-2xl border border-border p-3 opacity-70">
                  <SqueekAvatar tokenId={s.tokenId} className="size-10" />
                  <span className="flex-1 text-sm">
                    #{s.tokenId} <span className="text-xs text-muted-foreground">Level {s.level}</span>
                  </span>
                  <Badge tone="muted">
                    {st.state === 'activating' && 'Activating'}
                    {st.state === 'max' && 'Max level'}
                    {st.state === 'cooldown' && `Cooldown ${blocksToDuration(st.blocksLeft, network.blocksPerDay)}`}
                  </Badge>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="sticky bottom-24 flex flex-col gap-2">
        {survivor && donor && (
          <p className="text-center text-xs text-muted-foreground">
            Result: Squeek #{survivor.tokenId} at level {survivor.level + 1}, power {outcome}.
          </p>
        )}
        <Btn disabled={!survivor || !donor} onClick={review}>
          Review merge
        </Btn>
      </div>
    </div>
  )
}
