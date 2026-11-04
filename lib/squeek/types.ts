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
  unclaimed: string
  ethBalance: string
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
  | { action: 'claim'; tokenIds: string[]; rationale: string }
  | { action: 'checkpoint'; rationale: string }
  | { action: 'merge'; survivorId: string; donorId: string; rationale: string }
