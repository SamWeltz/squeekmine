export type LevelPolicy = { level: number; weight: string; cooldownBlocks: string }

export type NetworkStats = {
  fetchedAt: number
  headBlock: string
  rewardPerBlock: string
  supplyCap: string
  minted: string
  totalWeight: string
  /** SqueekCore completed Squeek block height. */
  completedBlocks: string
  blocksPerDay: number
  genesisTimestamp: number
  levels: LevelPolicy[]
  maximumLevel: number
  checkpoint: { corePaused: boolean; nextRound: string; roundSettled: boolean }
  processedThroughRound: string
  coreSettledThroughRound: string
}

export type SqueekPosition = {
  tokenId: string
  level: number
  /** 'wallet' = held in the wallet (not earning). 'staked' = deposited in SqueekStaking (earning). */
  custody: 'wallet' | 'staked'
  /** Base power for this level, in whole power units (same units as the network level table). */
  power: string
  activeWeight: string
  pendingWeight: string
  pendingRound: number
  nextMergeBlock: string
  claimable: string
}

export type ActivityItem = {
  id: string
  kind: 'mint' | 'received' | 'sent' | 'burn' | 'sqk_in' | 'sqk_out' | 'claim'
  title: string
  detail: string
  amount?: string
  tx: string
  block: string
  timestamp: number
}

export type AccountData = {
  address: string
  network: NetworkStats
  squeeks: SqueekPosition[]
  sqkBalance: string
  /** Claimable SQK for the whole account (rewards belong to the staker, not to a Squeek). */
  unclaimed: string
  ethBalance: string
  /** Whether SqueekStaking is approved to take this wallet's Squeeks. */
  stakingApproved: boolean
  activity: ActivityItem[]
}

export type TxDetail = { label: string; value: string }

export type TxRequest = {
  title: string
  summary: string
  contract: { name: string; address: `0x${string}` }
  abi: import('viem').Abi
  functionName: string
  args: readonly unknown[]
  details: TxDetail[]
  warnings?: string[]
  /** Keys of SWR caches to refresh after confirmation. */
  refresh?: boolean
}

export type Proposal =
  | { action: 'claim'; rationale: string }
  | { action: 'checkpoint'; rationale: string }
  | { action: 'merge'; survivorId: string; donorId: string; rationale: string }
