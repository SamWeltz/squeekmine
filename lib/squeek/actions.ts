import { erc20Abi, parseUnits } from 'viem'
import { CONTRACTS, MAX_CLAIM_IDS, SQUEEKS_COLLECTION, TOKEN_DECIMALS } from './config'
import { blocksToDuration, formatSqk, shortAddr } from './format'
import type { NetworkStats, SqueekPosition, TxRequest } from './types'

export function claimRequest(ids: string[], squeeks: SqueekPosition[]): TxRequest {
  const picked = ids.slice(0, MAX_CLAIM_IDS)
  const total = squeeks
    .filter((s) => picked.includes(s.tokenId))
    .reduce((t, s) => t + BigInt(s.claimable), 0n)
  return {
    title: 'Claim SQK',
    summary: `Claim about ${formatSqk(total, 4)} testnet SQK from ${picked.length} Squeek${picked.length === 1 ? '' : 's'}.`,
    contract: { name: CONTRACTS.mining.name, address: CONTRACTS.mining.address },
    abi: CONTRACTS.mining.abi,
    functionName: 'claim',
    args: [SQUEEKS_COLLECTION, picked.map((id) => BigInt(id))],
    details: [
      { label: 'Squeeks', value: picked.map((id) => `#${id}`).join(', ') },
      { label: 'Estimated payout', value: `${formatSqk(total, 4)} SQK (testnet)` },
    ],
    warnings:
      ids.length > MAX_CLAIM_IDS ? [`Only the first ${MAX_CLAIM_IDS} Squeeks fit in one claim. Claim again for the rest.`] : undefined,
    refresh: true,
  }
}

export function checkpointRequest(): TxRequest {
  return {
    title: 'Run checkpoint',
    summary: 'Process settled rounds so activations and rewards are up to date. Anyone can run this.',
    contract: { name: CONTRACTS.mining.name, address: CONTRACTS.mining.address },
    abi: CONTRACTS.mining.abi,
    functionName: 'checkpoint',
    args: [],
    details: [{ label: 'Effect', value: 'Updates reward accounting. Moves no tokens.' }],
    refresh: true,
  }
}

export function mergeRequest(
  survivor: SqueekPosition,
  donor: SqueekPosition,
  network: NetworkStats,
): TxRequest {
  const w = (lvl: number) => Number(network.levels.find((l) => l.level === lvl)?.weight ?? 0)
  const next = survivor.level + 1
  const cooldown = Number(network.levels.find((l) => l.level === next)?.cooldownBlocks ?? 0)
  return {
    title: 'Merge Squeeks',
    summary: `Merge #${donor.tokenId} into #${survivor.tokenId}. #${donor.tokenId} is burned permanently.`,
    contract: { name: CONTRACTS.mining.name, address: CONTRACTS.mining.address },
    abi: CONTRACTS.mining.abi,
    functionName: 'merge',
    args: [SQUEEKS_COLLECTION, BigInt(survivor.tokenId), BigInt(donor.tokenId)],
    details: [
      { label: 'Survivor', value: `#${survivor.tokenId} (level ${survivor.level} to ${next})` },
      { label: 'Burned', value: `#${donor.tokenId}` },
      { label: 'Power', value: `${2 * w(survivor.level)} now, ${w(next)} after activation` },
      {
        label: 'Next merge cooldown',
        value: `${cooldown} completed blocks (about ${blocksToDuration(cooldown, network.blocksPerDay)})`,
      },
    ],
    warnings: [
      `Squeek #${donor.tokenId} will be burned. This cannot be undone.`,
      'New power starts earning from the round after the merge.',
    ],
    refresh: true,
  }
}

export function transferSqkRequest(to: `0x${string}`, amount: string): TxRequest {
  return {
    title: 'Send SQK',
    summary: `Send ${amount} testnet SQK to ${shortAddr(to)}.`,
    contract: { name: CONTRACTS.token.name, address: CONTRACTS.token.address },
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, parseUnits(amount, TOKEN_DECIMALS)],
    details: [
      { label: 'To', value: to },
      { label: 'Amount', value: `${amount} SQK (testnet)` },
    ],
    warnings: ['Check the address. Transfers cannot be reversed.'],
    refresh: true,
  }
}
