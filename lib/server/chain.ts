import {
  createPublicClient,
  fallback,
  getAbiItem,
  http,
  isAddress,
  type AbiEvent,
  type Address,
  type PublicClient,
} from 'viem'
import {
  ACTIVE_CHAIN,
  CONTRACTS,
  DEPLOYMENT_BLOCK,
  SQUEEKS_COLLECTION,
  ZERO_ADDRESS,
} from '@/lib/squeek/config'
import { formatSqk } from '@/lib/squeek/format'
import type {
  AccountData,
  ActivityItem,
  LevelPolicy,
  NetworkStats,
  SqueekPosition,
} from '@/lib/squeek/types'

// The RPC URL may carry a provider key, so it is only ever read here, on the server.
const PUBLIC_RPC_URLS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.gateway.tenderly.co',
]
const rpcUrls = [process.env.SEPOLIA_RPC_URL, ...PUBLIC_RPC_URLS].filter((u): u is string => !!u)

const client: PublicClient = createPublicClient({
  chain: ACTIVE_CHAIN,
  transport: fallback(rpcUrls.map((url) => http(url, { timeout: 15_000, retryCount: 1 }))),
}) as PublicClient

const LOG_CHUNK = BigInt(process.env.LOG_CHUNK_BLOCKS ?? '10000')
const LOG_CONCURRENCY = 4

export { client as serverClient }

export function parseAddress(value: string | null): Address | null {
  if (!value || !isAddress(value)) return null
  return value as Address
}

export async function readNetwork(): Promise<NetworkStats> {
  const m = CONTRACTS.mining
  const c = CONTRACTS.core
  const [head, results] = await Promise.all([
    client.getBlockNumber(),
    client.multicall({
      allowFailure: false,
      contracts: [
        { address: m.address, abi: m.abi, functionName: 'REWARD_PER_BLOCK' },
        { address: m.address, abi: m.abi, functionName: 'SUPPLY_CAP' },
        { address: m.address, abi: m.abi, functionName: 'state' },
        {
          address: m.address,
          abi: m.abi,
          functionName: 'collectionPolicy',
          args: [SQUEEKS_COLLECTION],
        },
        { address: m.address, abi: m.abi, functionName: 'checkpointStatus' },
        { address: c.address, abi: c.abi, functionName: 'state' },
        { address: c.address, abi: c.abi, functionName: 'configuration' },
      ],
    }),
  ])

  const [reward, cap, state, policy, cpStatus, coreState, coreConfig] = results as [
    bigint,
    bigint,
    Record<string, bigint | number | boolean>,
    { maximumLevel: number; levels: readonly { weight: bigint; cooldownBlocks: bigint }[] },
    readonly [boolean, bigint, boolean],
    Record<string, bigint | number | boolean>,
    Record<string, bigint | number | boolean>,
  ]

  const genesis = Number(coreConfig.genesisTimestamp)
  const completed = BigInt(coreState.blockHeight as bigint | number)
  const elapsedDays = Math.max(1e-6, (Date.now() / 1000 - genesis) / 86400)
  const blocksPerDay = Number(completed) / elapsedDays

  const levels: LevelPolicy[] = policy.levels.map((l, i) => ({
    level: i + 1,
    weight: l.weight.toString(),
    cooldownBlocks: l.cooldownBlocks.toString(),
  }))

  return {
    fetchedAt: Date.now(),
    headBlock: head.toString(),
    rewardPerBlock: reward.toString(),
    supplyCap: cap.toString(),
    minted: String(state.minted),
    totalWeight: String(state.totalWeight),
    completedBlocks: completed.toString(),
    blocksPerDay,
    genesisTimestamp: genesis,
    levels,
    maximumLevel: Number(policy.maximumLevel),
    checkpoint: {
      corePaused: cpStatus[0],
      nextRound: cpStatus[1].toString(),
      roundSettled: cpStatus[2],
    },
    processedThroughRound: String(state.processedThroughRound),
    coreSettledThroughRound: String(coreState.settledThroughRound),
  }
}

type RawEvent = {
  kind: 'nft_in' | 'nft_out' | 'sqk_in' | 'sqk_out' | 'claim'
  block: bigint
  logIndex: number
  tx: string
  tokenId?: string
  tokenIds?: string[]
  amount?: bigint
  counterparty?: string
}

type Cache = { scanned: bigint; events: RawEvent[] }
const globalStore = globalThis as unknown as { __sqkCache?: Map<string, Cache> }
const cache = (globalStore.__sqkCache ??= new Map<string, Cache>())

async function getLogsChunked(
  params: { address: Address; event: AbiEvent; args: Record<string, unknown> },
  from: bigint,
  to: bigint,
) {
  const ranges: [bigint, bigint][] = []
  for (let s = from; s <= to; s += LOG_CHUNK) {
    const end = s + LOG_CHUNK - 1n
    ranges.push([s, end > to ? to : end])
  }
  const out: Awaited<ReturnType<PublicClient['getLogs']>> = []
  for (let i = 0; i < ranges.length; i += LOG_CONCURRENCY) {
    const batch = await Promise.all(
      ranges.slice(i, i + LOG_CONCURRENCY).map(([fromBlock, toBlock]) =>
        client.getLogs({
          address: params.address,
          event: params.event,
          args: params.args,
          fromBlock,
          toBlock,
        } as never),
      ),
    )
    for (const logs of batch) out.push(...(logs as typeof out))
  }
  return out
}

const nftTransfer = getAbiItem({ abi: CONTRACTS.nft.abi, name: 'Transfer' }) as AbiEvent
const tokenTransfer = getAbiItem({ abi: CONTRACTS.token.abi, name: 'Transfer' }) as AbiEvent
const rewardsClaimed = getAbiItem({ abi: CONTRACTS.mining.abi, name: 'RewardsClaimed' }) as AbiEvent

type AnyLog = { args: Record<string, unknown>; blockNumber: bigint; logIndex: number; transactionHash: string }

async function getAccountEvents(address: Address): Promise<RawEvent[]> {
  const key = address.toLowerCase()
  const head = await client.getBlockNumber()
  const entry = cache.get(key) ?? { scanned: DEPLOYMENT_BLOCK - 1n, events: [] }
  if (head > entry.scanned) {
    const from = entry.scanned + 1n
    const [nftIn, nftOut, sqkIn, sqkOut, claims] = await Promise.all([
      getLogsChunked({ address: CONTRACTS.nft.address, event: nftTransfer, args: { to: address } }, from, head),
      getLogsChunked({ address: CONTRACTS.nft.address, event: nftTransfer, args: { from: address } }, from, head),
      getLogsChunked({ address: CONTRACTS.token.address, event: tokenTransfer, args: { to: address } }, from, head),
      getLogsChunked({ address: CONTRACTS.token.address, event: tokenTransfer, args: { from: address } }, from, head),
      getLogsChunked({ address: CONTRACTS.mining.address, event: rewardsClaimed, args: { owner: address } }, from, head),
    ])
    const fresh: RawEvent[] = []
    const base = (l: AnyLog) => ({ block: l.blockNumber, logIndex: l.logIndex, tx: l.transactionHash })
    for (const l of nftIn as unknown as AnyLog[])
      fresh.push({ ...base(l), kind: 'nft_in', tokenId: String(l.args.tokenId), counterparty: String(l.args.from) })
    for (const l of nftOut as unknown as AnyLog[])
      fresh.push({ ...base(l), kind: 'nft_out', tokenId: String(l.args.tokenId), counterparty: String(l.args.to) })
    for (const l of sqkIn as unknown as AnyLog[])
      fresh.push({ ...base(l), kind: 'sqk_in', amount: l.args.value as bigint, counterparty: String(l.args.from) })
    for (const l of sqkOut as unknown as AnyLog[])
      fresh.push({ ...base(l), kind: 'sqk_out', amount: l.args.value as bigint, counterparty: String(l.args.to) })
    for (const l of claims as unknown as AnyLog[])
      fresh.push({
        ...base(l),
        kind: 'claim',
        amount: l.args.amount as bigint,
        tokenIds: (l.args.tokenIds as bigint[]).map(String),
      })
    entry.events.push(...fresh)
    entry.scanned = head
    cache.set(key, entry)
  }
  return entry.events
}

async function buildActivity(events: RawEvent[], head: bigint): Promise<ActivityItem[]> {
  const mining = CONTRACTS.mining.address.toLowerCase()
  const zero = ZERO_ADDRESS.toLowerCase()
  const relevant = events
    .filter((e) => !(e.kind === 'sqk_in' && e.counterparty?.toLowerCase() === mining))
    .sort((a, b) => (a.block === b.block ? b.logIndex - a.logIndex : a.block > b.block ? -1 : 1))
    .slice(0, 30)

  const uniqueBlocks = [...new Set(relevant.map((e) => e.block))].slice(0, 15)
  const stamps = new Map<bigint, number>()
  await Promise.all(
    uniqueBlocks.map(async (b) => {
      try {
        const blk = await client.getBlock({ blockNumber: b })
        stamps.set(b, Number(blk.timestamp))
      } catch {
        /* estimated below */
      }
    }),
  )
  const nowSec = Math.floor(Date.now() / 1000)

  return relevant.map((e, i) => {
    const timestamp = stamps.get(e.block) ?? nowSec - Number(head - e.block) * 12
    const cp = e.counterparty?.toLowerCase()
    let kind: ActivityItem['kind']
    let title: string
    let detail = ''
    let amount: string | undefined
    switch (e.kind) {
      case 'nft_in':
        kind = cp === zero ? 'mint' : 'received'
        title = cp === zero ? `Squeek #${e.tokenId} minted` : `Received Squeek #${e.tokenId}`
        detail = cp === zero ? 'New Squeek registered for mining' : `From ${e.counterparty?.slice(0, 8)}...`
        break
      case 'nft_out':
        kind = cp === zero ? 'burn' : 'sent'
        title = cp === zero ? `Squeek #${e.tokenId} burned` : `Sent Squeek #${e.tokenId}`
        detail = cp === zero ? 'Burned as a merge donor' : `To ${e.counterparty?.slice(0, 8)}...`
        break
      case 'sqk_in':
        kind = 'sqk_in'
        title = 'Received SQK'
        detail = `From ${e.counterparty?.slice(0, 8)}...`
        amount = e.amount!.toString()
        break
      case 'sqk_out':
        kind = 'sqk_out'
        title = 'Sent SQK'
        detail = `To ${e.counterparty?.slice(0, 8)}...`
        amount = e.amount!.toString()
        break
      default:
        kind = 'claim'
        title = 'Claimed SQK'
        detail = `${e.tokenIds?.length ?? 0} Squeek${e.tokenIds?.length === 1 ? '' : 's'}`
        amount = e.amount!.toString()
    }
    return { id: `${e.tx}-${e.logIndex}-${i}`, kind, title, detail, amount, tx: e.tx, block: e.block.toString(), timestamp }
  })
}

export async function readAccount(address: Address): Promise<AccountData> {
  const [network, events] = await Promise.all([readNetwork(), getAccountEvents(address)])

  const candidateIds = [...new Set(events.filter((e) => e.kind === 'nft_in').map((e) => e.tokenId!))]
  const owners = candidateIds.length
    ? await client.multicall({
        allowFailure: true,
        contracts: candidateIds.map((id) => ({
          address: CONTRACTS.nft.address,
          abi: CONTRACTS.nft.abi,
          functionName: 'ownerOf',
          args: [BigInt(id)],
        })),
      })
    : []
  const ownedIds = candidateIds
    .filter((_, i) => owners[i].status === 'success' && String(owners[i].result).toLowerCase() === address.toLowerCase())
    .sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1))

  const [positions, claimables, balances] = await Promise.all([
    ownedIds.length
      ? client.multicall({
          allowFailure: true,
          contracts: ownedIds.map((id) => ({
            address: CONTRACTS.mining.address,
            abi: CONTRACTS.mining.abi,
            functionName: 'position',
            args: [SQUEEKS_COLLECTION, BigInt(id)],
          })),
        })
      : Promise.resolve([]),
    ownedIds.length
      ? client.multicall({
          allowFailure: true,
          contracts: ownedIds.map((id) => ({
            address: CONTRACTS.mining.address,
            abi: CONTRACTS.mining.abi,
            functionName: 'claimable',
            args: [SQUEEKS_COLLECTION, [BigInt(id)]],
          })),
        })
      : Promise.resolve([]),
    Promise.all([
      client.readContract({
        address: CONTRACTS.token.address,
        abi: CONTRACTS.token.abi,
        functionName: 'balanceOf',
        args: [address],
      }) as Promise<bigint>,
      client.getBalance({ address }),
    ]),
  ])

  const squeeks: SqueekPosition[] = []
  ownedIds.forEach((id, i) => {
    const p = positions[i]
    if (p.status !== 'success') return
    const pos = p.result as {
      activeWeight: bigint
      pendingWeight: bigint
      pendingRound: number | bigint
      nextMergeBlock: number | bigint
      level: number
    }
    const claim = claimables[i]
    squeeks.push({
      tokenId: id,
      level: Number(pos.level),
      activeWeight: pos.activeWeight.toString(),
      pendingWeight: pos.pendingWeight.toString(),
      pendingRound: Number(pos.pendingRound),
      nextMergeBlock: pos.nextMergeBlock.toString(),
      claimable: claim.status === 'success' ? (claim.result as bigint).toString() : '0',
    })
  })

  const unclaimed = squeeks.reduce((t, s) => t + BigInt(s.claimable), 0n)
  const activity = await buildActivity(events, BigInt(network.headBlock))

  return {
    address,
    network,
    squeeks,
    sqkBalance: balances[0].toString(),
    unclaimed: unclaimed.toString(),
    ethBalance: balances[1].toString(),
    activity,
  }
}

export function describeAccountForAi(data: AccountData): string {
  const n = data.network
  const lines = [
    `Network: Sepolia TESTNET. Token SQK has no real value.`,
    `Wallet ${data.address}: ${data.squeeks.length} Squeeks, ${formatSqk(data.sqkBalance)} SQK in wallet, ${formatSqk(data.unclaimed)} SQK unclaimed in mining, ${formatSqk(data.ethBalance, 4)} ETH.`,
    `Chain: reward per Squeek block ${formatSqk(n.rewardPerBlock, 0)} SQK, total active power ${n.totalWeight}, est. ${n.blocksPerDay.toFixed(1)} Squeek blocks/day, completed block height ${n.completedBlocks}, merge max level ${n.maximumLevel}.`,
    `Level power: ${n.levels.map((l) => `L${l.level}=${l.weight}`).join(', ')}.`,
    `Checkpoint: next round ${n.checkpoint.nextRound}, settled=${n.checkpoint.roundSettled}, corePaused=${n.checkpoint.corePaused}.`,
    'Squeeks (id, level, activePower, pendingPower, nextMergeBlock, claimableSQK):',
    ...data.squeeks.map(
      (s) =>
        `- #${s.tokenId} L${s.level} active=${s.activeWeight} pending=${s.pendingWeight} nextMerge=${s.nextMergeBlock} claimable=${formatSqk(s.claimable, 4)}`,
    ),
  ]
  return lines.join('\n')
}
