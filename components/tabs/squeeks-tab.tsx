'use client'

import { Badge, Btn, Card, EmptyState, ErrorCard, SectionTitle, Skeleton, SqueekAvatar } from '@/components/kit'
import { ConnectPrompt } from '@/components/connect-prompt'
import { useAuth } from '@/lib/auth'
import { useAccountData } from '@/lib/hooks'
import {
  approveStakingRequest,
  checkpointRequest,
  claimRequest,
  depositRequest,
  withdrawRequest,
} from '@/lib/squeek/actions'
import { MAX_DEPOSIT_IDS } from '@/lib/squeek/config'
import { blocksToDuration, formatCompact, formatSqk } from '@/lib/squeek/format'
import { mergeState, miningLabel } from '@/lib/squeek/planner'
import { useUI } from '@/lib/ui-context'

export function SqueeksTab() {
  const auth = useAuth()
  const { openSheet, setTab } = useUI()
  const { data, error, isLoading, mutate } = useAccountData(auth.address)

  if (!auth.connected) return <ConnectPrompt what="see and stake your Squeeks" />
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

  const { network, squeeks, address, stakingApproved } = data
  const account = address as `0x${string}`
  const unclaimed = BigInt(data.unclaimed)
  const inWallet = squeeks.filter((s) => s.custody === 'wallet')
  const needsCheckpoint = BigInt(network.processedThroughRound) < BigInt(network.coreSettledThroughRound)

  // Staking needs a one-time approval first, then the deposit itself.
  const stakeTx = (ids: string[]) => (stakingApproved ? depositRequest(ids) : approveStakingRequest())

  if (squeeks.length === 0) {
    return (
      <EmptyState
        title="No Squeeks in this wallet"
        body="Mint a Squeek on the Squeekchain testnet, then it will appear here. Stake it to start earning SQK."
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
          <p className="text-xs text-muted-foreground">Claimable (testnet)</p>
          <p className="text-2xl font-bold">{formatSqk(unclaimed, 4)} SQK</p>
        </div>
        <Btn
          size="sm"
          disabled={unclaimed === 0n}
          onClick={() => openSheet({ type: 'tx', tx: claimRequest(account, unclaimed.toString()) })}
        >
          Claim
        </Btn>
      </Card>

      {inWallet.length > 0 && (
        <Card className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              {inWallet.length} Squeek{inWallet.length === 1 ? '' : 's'} not earning
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {stakingApproved
                ? 'Stake them to start earning SQK. You can withdraw any time.'
                : 'Allow staking once, then stake. Nothing moves until you confirm each stake.'}
            </p>
          </div>
          <Btn
            size="sm"
            onClick={() =>
              openSheet({ type: 'tx', tx: stakeTx(inWallet.slice(0, MAX_DEPOSIT_IDS).map((s) => s.tokenId)) })
            }
          >
            {stakingApproved ? 'Stake all' : 'Allow staking'}
          </Btn>
        </Card>
      )}

      <section aria-label="Your Squeeks">
        <SectionTitle>{squeeks.length} Squeeks</SectionTitle>
        <ul className="flex flex-col gap-3">
          {squeeks.map((s) => {
            const label = miningLabel(s)
            const merge = mergeState(s, network.completedBlocks, network.maximumLevel)
            return (
              <li key={s.tokenId}>
                <Card className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <SqueekAvatar tokenId={s.tokenId} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Squeek #{s.tokenId}</p>
                      <p className="text-xs text-muted-foreground">
                        Level {s.level}. Power {formatCompact(Number(s.power))}
                      </p>
                    </div>
                    <Badge tone={label.tone === 'up' ? 'up' : label.tone === 'warn' ? 'warn' : 'muted'}>{label.label}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                    <div className="flex items-center gap-2">
                      {merge.state === 'ready' && <Badge tone="lime">Can merge</Badge>}
                      {merge.state === 'cooldown' && (
                        <Badge tone="muted">Merge in {blocksToDuration(merge.blocksLeft, network.blocksPerDay)}</Badge>
                      )}
                      {merge.state === 'max' && <Badge tone="muted">Max level</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      {merge.state === 'ready' && (
                        <Btn size="sm" variant="ghost" onClick={() => setTab('merge')}>
                          Merge
                        </Btn>
                      )}
                      {s.custody === 'wallet' ? (
                        <Btn size="sm" variant="secondary" onClick={() => openSheet({ type: 'tx', tx: stakeTx([s.tokenId]) })}>
                          {stakingApproved ? 'Stake' : 'Allow staking'}
                        </Btn>
                      ) : (
                        <Btn size="sm" variant="secondary" onClick={() => openSheet({ type: 'tx', tx: withdrawRequest([s.tokenId]) })}>
                          Withdraw
                        </Btn>
                      )}
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
