'use client'

import { Badge, Btn, Card, EmptyState, ErrorCard, SectionTitle, Skeleton, SqueekAvatar } from '@/components/kit'
import { ConnectPrompt } from '@/components/connect-prompt'
import { useAuth } from '@/lib/auth'
import { useAccountData } from '@/lib/hooks'
import { checkpointRequest, claimRequest } from '@/lib/squeek/actions'
import { MAX_CLAIM_IDS } from '@/lib/squeek/config'
import { blocksToDuration, formatCompact, formatSqk } from '@/lib/squeek/format'
import { mergeState, miningLabel } from '@/lib/squeek/planner'
import { useUI } from '@/lib/ui-context'

export function SqueeksTab() {
  const auth = useAuth()
  const { openSheet, setTab } = useUI()
  const { data, error, isLoading, mutate } = useAccountData(auth.address)

  if (!auth.connected) return <ConnectPrompt what="see and claim your Squeeks" />
  if (error && !data) return <ErrorCard message={error.message} onRetry={() => mutate()} />
  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    )
  }

  const { network, squeeks } = data
  const claimable = squeeks.filter((s) => BigInt(s.claimable) > 0n)
  const claimTotal = claimable.reduce((t, s) => t + BigInt(s.claimable), 0n)
  const needsCheckpoint = BigInt(network.processedThroughRound) < BigInt(network.coreSettledThroughRound)

  if (squeeks.length === 0) {
    return (
      <EmptyState
        title="No Squeeks in this wallet"
        body="Mint a Squeek on the Squeekchain testnet, then it will appear here and start earning."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {needsCheckpoint && (
        <Card className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Checkpoint available</p>
            <p className="text-xs leading-relaxed text-muted-foreground">Settled rounds are waiting to be processed. Anyone can run it.</p>
          </div>
          <Btn size="sm" variant="secondary" onClick={() => openSheet({ type: 'tx', tx: checkpointRequest() })}>
            Run
          </Btn>
        </Card>
      )}

      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Unclaimed (testnet)</p>
          <p className="text-2xl font-bold">{formatSqk(claimTotal, 4)} SQK</p>
        </div>
        <Btn
          size="sm"
          disabled={claimable.length === 0}
          onClick={() =>
            openSheet({
              type: 'tx',
              tx: claimRequest(
                claimable.slice(0, MAX_CLAIM_IDS).map((s) => s.tokenId),
                squeeks,
              ),
            })
          }
        >
          Claim all
        </Btn>
      </Card>

      <section aria-label="Your Squeeks">
        <SectionTitle>{squeeks.length} Squeeks</SectionTitle>
        <ul className="flex flex-col gap-3">
          {squeeks.map((s) => {
            const label = miningLabel(s)
            const merge = mergeState(s, network.completedBlocks, network.maximumLevel)
            const claim = BigInt(s.claimable)
            return (
              <li key={s.tokenId}>
                <Card className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <SqueekAvatar tokenId={s.tokenId} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Squeek #{s.tokenId}</p>
                      <p className="text-xs text-muted-foreground">
                        Level {s.level}. Power {formatCompact(Number(s.activeWeight))}
                        {BigInt(s.pendingWeight) > 0n && ` (+${formatCompact(Number(s.pendingWeight))} pending)`}
                      </p>
                    </div>
                    <Badge tone={label.tone === 'up' ? 'up' : label.tone === 'warn' ? 'warn' : 'muted'}>{label.label}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                    <div className="text-xs">
                      <p className="text-muted-foreground">Claimable</p>
                      <p className="font-semibold">{formatSqk(claim, 4)} SQK</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {merge.state === 'ready' && (
                        <Badge tone="lime">Can merge</Badge>
                      )}
                      {merge.state === 'cooldown' && (
                        <Badge tone="muted">Merge in {blocksToDuration(merge.blocksLeft, network.blocksPerDay)}</Badge>
                      )}
                      {merge.state === 'max' && <Badge tone="muted">Max level</Badge>}
                      {merge.state === 'ready' && (
                        <Btn size="sm" variant="ghost" onClick={() => setTab('merge')}>
                          Merge
                        </Btn>
                      )}
                      <Btn
                        size="sm"
                        variant="secondary"
                        disabled={claim === 0n}
                        onClick={() => openSheet({ type: 'tx', tx: claimRequest([s.tokenId], squeeks) })}
                      >
                        Claim
                      </Btn>
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
