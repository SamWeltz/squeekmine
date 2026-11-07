import {
  createPublicClient,
  erc20Abi,
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
  GENESIS_TIMESTAMP,
  TEST_MINTER,
  ZERO_ADDRESS,
} from '@/lib/squeek/config'
import { nftAbi, stakingAbi } from '@/lib/squeek/abi/squeek'
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
const WAD = 10n ** 18n

export { client as serverClient }

export function parseAddress(value: string | null): Address | null {
  if (!value || !isAddress(value)) return null
  return value as Address
}

type CoreState = { settledThroughRound: bigint; blockHeight: bigint }
type MiningState = {
  minted: bigint
  processedThroughRound: bigint
  startRound: bigint
  startHeight: bigint
  fundedBlocks: bigint
  startCaptured: boolean
  paused: boolean
}
type Schedule = { launchBonus: bigint; bonusBlocks: bigint; halvingBlocks: bigint; firstPeriodRate: bigint }
type RewardState = { totalNftPower: bigint; totalSqkPower: bigint }

/** Issuance per completed Squeek block right now, from the Mining schedule (SQK base units). */
function currentRewardPerBlock(completed: bigint, state: MiningState, s: Schedule): bigint {
  if (!state.startCaptured || s.halvingBlocks === 0n) return 0n
  const b = completed > state.startHeight ? completed - state.startHeight : 0n
  const period = b / s.halvingBlocks
  const base = period >= 3n ? 0n : s.firstPeriodRate >> period
  const bonus = s.bonusBlocks > 0n && b < s.bonusBlocks ? s.launchBonus / s.bonusBlocks : 0n
  return base + bonus
}

export async function readNetwork(): Promise<NetworkStats> {
  const { core, mining, staking, nft } = CONTRACTS
  const MAXLEVEL_FALLBACK = 10

  const [head, first] = await Promise.all([
    client.getBlockNumber(),
    client.multicall({
      allowFailure: true,
      contracts: [
        { address: core.address, abi: core.abi, functionName: 'state' },
        { address: mining.address, abi: mining.abi, functionName: 'state' },
        { address: mining.address, abi: mining.abi, functionName: 'issuanceSchedule' },
        { address: mining.address, abi: mining.abi, functionName: 'SUPPLY_CAP' },
        { address: mining.address, abi: mining.abi, functionName: 'checkpointStatus' },
        { address: staking.address, abi: staking.abi, functionName: 'rewardState' },
        { address: nft.address, abi: nft.abi, functionName: 'MAXIMUM_LEVEL' },
      ],
    }),
  ])

  const [coreRes, miningRes, schedRes, capRes, cpRes, rewardRes, maxRes] = first
  if (coreRes.status !== 'success') throw new Error('Could not read SqueekCore state')
  if (miningRes.status !== 'success') throw new Error('Could not read SqueekMining state')

  const coreState = coreRes.result as unknown as CoreState
  const miningState = miningRes.result as unknown as MiningState
  const schedule = (schedRes.status === 'success' ? schedRes.result : undefined) as unknown as Schedule | undefined
  const reward = (rewardRes.status === 'success' ? rewardRes.result : undefined) as unknown as RewardState | undefined
  const maximumLevel = maxRes.status === 'success' ? Number(maxRes.result) : MAXLEVEL_FALLBACK

  // Level table: power per level from Staking, merge cooldown per level from the NFT.
  const levelNumbers = Array.from({ length: maximumLevel }, (_, i) => i + 1)
  const levelReads = await client.multicall({
    allowFailure: true,
    contracts: levelNumbers.flatMap((lvl) => [
      { address: staking.address, abi: staking.abi, functionName: 'basePower', args: [nft.address, lvl] },
      { address: nft.address, abi: nft.abi, functionName: 'cooldownBlocks', args: [lvl] },
    ]),
  })
  const levels: LevelPolicy[] = levelNumbers.map((lvl, i) => {
    const w = levelReads[i * 2]
    const c = levelReads[i * 2 + 1]
    return {
      level: lvl,
      weight: w.status === 'success' ? String(w.result) : '0',
      cooldownBlocks: c.status === 'success' ? String(c.result) : '0',
    }
  })

  const completed = coreState.blockHeight
  const elapsedDays = Math.max(1e-6, (Date.now() / 1000 - GENESIS_TIMESTAMP) / 86400)
  const blocksPerDay = Number(completed) / elapsedDays
  const rewardPerBlock = schedule ? currentRewardPerBlock(completed, miningState, schedule) : 0n
  const totalPowerWad = reward ? reward.totalNftPower + reward.totalSqkPower : 0n

  const cp = cpRes.status === 'success' ? (cpRes.result as unknown as readonly [boolean, bigint, boolean]) : undefined

  return {
    fetchedAt: Date.now(),
    headBlock: head.toString(),
    rewardPerBlock: rewardPerBlock.toString(),
    supplyCap: capRes.status === 'success' ? String(capRes.result) : '0',
    minted: miningState.minted.toString(),
    // Whole power units (NFT power plus boosted SQK power), to match the level table.
    totalWeight: (totalPowerWad / WAD).toString(),
    completedBlocks: completed.toString(),
    blocksPerDay,
    genesisTimestamp: GENESIS_TIMESTAMP,
    levels,
    maximumLevel,
    checkpoint: {
      corePaused: cp ? cp[0] : false,
      nextRound: cp ? cp[1].toString() : '0',
      roundSettled: cp ? cp[2] : false,
    },
    processedThroughRound: miningState.processedThroughRound.toString(),
    coreSettledThroughRound: coreState.settledThroughRound.toString(),
  }
}

type RawEvent = {
  kind: 'nft_in' | 'nft_out' | 'sqk_in' | 'sqk_out' | 'claim'
  block: bigint
  logIndex: number
  tx: string
  tokenId?: string
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

const nftTransfer = getAbiItem({ abi: nftAbi, name: 'Transfer' }) as AbiEvent
const tokenTransfer = getAbiItem({ abi: erc20Abi, name: 'Transfer' }) as AbiEvent
const rewardClaimed = getAbiItem({ abi: stakingAbi, name: 'RewardClaimed' }) as AbiEvent

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
      getLogsChunked({ address: CONTRACTS.staking.address, event: rewardClaimed, args: { account: address } }, from, head),
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
      fresh.push({ ...base(l), kind: 'claim', amount: l.args.amount as bigint })
    entry.events.push(...fresh)
    entry.scanned = head
    cache.set(key, entry)
  }
  return entry.events
}

async function buildActivity(events: RawEvent[], head: bigint): Promise<ActivityItem[]> {
  const staking = CONTRACTS.staking.address.toLowerCase()
  const minter = TEST_MINTER.toLowerCase()
  const zero = ZERO_ADDRESS.toLowerCase()
  const relevant = events
    // Claim payouts arrive as a transfer from Staking; the claim event already covers them.
    .filter((e) => !(e.kind === 'sqk_in' && e.counterparty?.toLowerCase() === staking))
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
        if (cp === zero || cp === minter) {
          kind = 'mint'
          title = `Squeek #${e.tokenId} minted`
          detail = 'New Squeek in your wallet'
        } else if (cp === staking) {
          kind = 'received'
          title = `Withdrew Squeek #${e.tokenId}`
          detail = 'Taken out of staking'
        } else {
          kind = 'received'
          title = `Received Squeek #${e.tokenId}`
          detail = `From ${e.counterparty?.slice(0, 8)}...`
        }
        break
      case 'nft_out':
        if (cp === zero) {
          kind = 'burn'
          title = `Squeek #${e.tokenId} burned`
          detail = 'Burned as a merge donor'
        } else if (cp === staking) {
          kind = 'sent'
          title = `Deposited Squeek #${e.tokenId}`
          detail = 'Now staking and earning'
        } else {
          kind = 'sent'
          title = `Sent Squeek #${e.tokenId}`
          detail = `To ${e.counterparty?.slice(0, 8)}...`
        }
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
        detail = 'Staking rewards'
        amount = e.amount!.toString()
    }
    return { id: `${e.tx}-${e.logIndex}-${i}`, kind, title, detail, amount, tx: e.tx, block: e.block.toString(), timestamp }
  })
}

export async function readAccount(address: Address): Promise<AccountData> {
  const [network, events] = await Promise.all([readNetwork(), getAccountEvents(address)])
  const { nft, staking, token } = CONTRACTS
  const me = address.toLowerCase()
  const stakingAddr = staking.address.toLowerCase()

  // Every Squeek this wallet ever received is a candidate (a deposited Squeek was received first).
  const candidateIds = [...new Set(events.filter((e) => e.kind === 'nft_in').map((e) => e.tokenId!))]

  const owners = candidateIds.length
    ? await client.multicall({
        allowFailure: true,
        contracts: candidateIds.map((id) => ({
          address: nft.address,
          abi: nft.abi,
          functionName: 'ownerOf',
          args: [BigInt(id)],
        })),
      })
    : []

  // Tokens held by Staking: check the depositor is this wallet.
  const inStakingIdx = candidateIds
    .map((id, i) => ({ id, i }))
    .filter(({ i }) => owners[i].status === 'success' && String(owners[i].result).toLowerCase() === stakingAddr)
  const depositors = inStakingIdx.length
    ? await client.multicall({
        allowFailure: true,
        contracts: inStakingIdx.map(({ id }) => ({
          address: staking.address,
          abi: staking.abi,
          functionName: 'depositor',
          args: [nft.address, BigInt(id)],
        })),
      })
    : []
  const stakedByMe = new Set<string>()
  inStakingIdx.forEach(({ id }, j) => {
    const d = depositors[j]
    if (d.status === 'success' && String(d.result).toLowerCase() === me) stakedByMe.add(id)
  })

  const owned: { id: string; custody: 'wallet' | 'staked' }[] = []
  candidateIds.forEach((id, i) => {
    const o = owners[i]
    if (o.status !== 'success') return // burned or not issued
    if (String(o.result).toLowerCase() === me) owned.push({ id, custody: 'wallet' })
    else if (stakedByMe.has(id)) owned.push({ id, custody: 'staked' })
  })
  owned.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))

  const [tokenStates, account] = await Promise.all([
    owned.length
      ? client.multicall({
          allowFailure: true,
          contracts: owned.flatMap(({ id }) => [
            { address: nft.address, abi: nft.abi, functionName: 'level', args: [BigInt(id)] },
            { address: nft.address, abi: nft.abi, functionName: 'nextMergeHeight', args: [BigInt(id)] },
          ]),
        })
      : Promise.resolve([]),
    Promise.all([
      client.readContract({ address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
      client.getBalance({ address }),
      client.readContract({ address: staking.address, abi: stakingAbi, functionName: 'claimable', args: [address] }) as Promise<bigint>,
      client.readContract({
        address: nft.address,
        abi: nftAbi,
        functionName: 'isApprovedForAll',
        args: [address, staking.address],
      }) as Promise<boolean>,
    ]),
  ])

  const weightByLevel = new Map(network.levels.map((l) => [l.level, l.weight]))
  const squeeks: SqueekPosition[] = []
  owned.forEach(({ id, custody }, i) => {
    const lv = tokenStates[i * 2]
    const nm = tokenStates[i * 2 + 1]
    if (lv.status !== 'success') return
    const level = Number(lv.result)
    const power = weightByLevel.get(level) ?? '0'
    squeeks.push({
      tokenId: id,
      level,
      custody,
      power,
      // Only staked Squeeks earn. Rewards are paid to the account, not per Squeek.
      activeWeight: custody === 'staked' ? power : '0',
      pendingWeight: '0',
      pendingRound: 0,
      nextMergeBlock: nm.status === 'success' ? String(nm.result) : '0',
      claimable: '0',
    })
  })

  const activity = await buildActivity(events, BigInt(network.headBlock))

  return {
    address,
    network,
    squeeks,
    sqkBalance: account[0].toString(),
    unclaimed: account[2].toString(),
    ethBalance: account[1].toString(),
    stakingApproved: account[3],
    activity,
  }
}

export function describeAccountForAi(data: AccountData): string {
  const n = data.network
  const lines = [
    `Network: Sepolia TESTNET. Token SQK has no real value.`,
    `Wallet ${data.address}: ${data.squeeks.length} Squeeks, ${formatSqk(data.sqkBalance)} SQK in wallet, ${formatSqk(data.unclaimed)} SQK claimable from staking, ${formatSqk(data.ethBalance, 4)} ETH.`,
    `Chain: reward per Squeek block ${formatSqk(n.rewardPerBlock, 0)} SQK, total staked power ${n.totalWeight}, est. ${n.blocksPerDay.toFixed(1)} Squeek blocks/day, completed block height ${n.completedBlocks}, merge max level ${n.maximumLevel}.`,
    `Level power: ${n.levels.map((l) => `L${l.level}=${l.weight}`).join(', ')}.`,
    'Squeeks (id, level, power, where it is, nextMergeBlock):',
    ...data.squeeks.map(
      (s) => `- #${s.tokenId} L${s.level} power=${s.power} ${s.custody === 'staked' ? 'staked (earning)' : 'in wallet (not earning)'} nextMerge=${s.nextMergeBlock}`,
    ),
  ]
  return lines.join('\n')
}
