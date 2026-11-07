import { erc20Abi, parseUnits } from 'viem'
import { CONTRACTS, MAX_DEPOSIT_IDS, TOKEN_DECIMALS } from './config'
import { blocksToDuration, formatSqk, shortAddr } from './format'
import type { NetworkStats, SqueekPosition, TxRequest } from './types'

const staking = { name: CONTRACTS.staking.name, address: CONTRACTS.staking.address }
const nft = { name: CONTRACTS.nft.name, address: CONTRACTS.nft.address }

/** Rewards belong to the staker's account, not to a single Squeek. */
export function claimRequest(account: `0x${string}`, amount: string): TxRequest {
  return {
    title: 'Claim SQK',
    summary: `Claim about ${formatSqk(amount, 4)} testnet SQK from your staking rewards.`,
    contract: staking,
    abi: CONTRACTS.staking.abi,
    functionName: 'claim',
    args: [account],
    details: [
      { label: 'Account', value: shortAddr(account) },
      { label: 'Estimated payout', value: `${formatSqk(amount, 4)} SQK (testnet)` },
    ],
    refresh: true,
  }
}

export function approveStakingRequest(): TxRequest {
  return {
    title: 'Allow staking',
    summary: 'Let the official SqueekStaking contract take your Squeeks when you choose to stake them.',
    contract: nft,
    abi: CONTRACTS.nft.abi,
    functionName: 'setApprovalForAll',
    args: [CONTRACTS.staking.address, true],
    details: [
      { label: 'Approves', value: `SqueekStaking (${shortAddr(CONTRACTS.staking.address)})` },
      { label: 'Effect', value: 'Nothing moves yet. You still confirm each stake.' },
    ],
    warnings: ['This lets the staking contract move any Squeek in this wallet when you stake. Only approve the official contract.'],
    refresh: true,
  }
}

export function depositRequest(ids: string[]): TxRequest {
  const picked = ids.slice(0, MAX_DEPOSIT_IDS)
  return {
    title: 'Stake Squeeks',
    summary: `Deposit ${picked.length} Squeek${picked.length === 1 ? '' : 's'} into staking so they earn SQK.`,
    contract: staking,
    abi: CONTRACTS.staking.abi,
    functionName: 'deposit',
    args: [CONTRACTS.nft.address, picked.map((id) => BigInt(id))],
    details: [
      { label: 'Squeeks', value: picked.map((id) => `#${id}`).join(', ') },
      { label: 'Effect', value: 'Their power counts toward rewards at once. You can withdraw any time.' },
    ],
    warnings: ids.length > MAX_DEPOSIT_IDS ? [`Only the first ${MAX_DEPOSIT_IDS} fit in one transaction.`] : undefined,
    refresh: true,
  }
}

export function withdrawRequest(ids: string[]): TxRequest {
  const picked = ids.slice(0, MAX_DEPOSIT_IDS)
  return {
    title: 'Withdraw Squeeks',
    summary: `Take ${picked.length} Squeek${picked.length === 1 ? '' : 's'} out of staking and back to your wallet.`,
    contract: staking,
    abi: CONTRACTS.staking.abi,
    functionName: 'withdraw',
    args: [CONTRACTS.nft.address, picked.map((id) => BigInt(id))],
    details: [
      { label: 'Squeeks', value: picked.map((id) => `#${id}`).join(', ') },
      { label: 'Effect', value: 'They stop earning. Rewards already earned stay claimable.' },
    ],
    refresh: true,
  }
}

export function checkpointRequest(): TxRequest {
  return {
    title: 'Run checkpoint',
    summary: 'Process settled rounds so rewards are issued to staking. Anyone can run this.',
    contract: { name: CONTRACTS.mining.name, address: CONTRACTS.mining.address },
    abi: CONTRACTS.mining.abi,
    functionName: 'checkpoint',
    args: [],
    details: [{ label: 'Effect', value: 'Funds staking rewards. You only pay gas.' }],
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
  const staked = survivor.custody === 'staked'
  return {
    title: 'Merge Squeeks',
    summary: `Merge #${donor.tokenId} into #${survivor.tokenId}. #${donor.tokenId} is burned permanently.`,
    // Squeeks held by the staking contract merge through it. Wallet Squeeks merge on the NFT itself.
    contract: staked ? staking : nft,
    abi: staked ? CONTRACTS.staking.abi : CONTRACTS.nft.abi,
    functionName: staked ? 'mergeDeposited' : 'merge',
    args: staked
      ? [CONTRACTS.nft.address, BigInt(survivor.tokenId), BigInt(donor.tokenId)]
      : [BigInt(survivor.tokenId), BigInt(donor.tokenId)],
    details: [
      { label: 'Survivor', value: `#${survivor.tokenId} (level ${survivor.level} to ${next})` },
      { label: 'Burned', value: `#${donor.tokenId}` },
      { label: 'Power', value: `${2 * w(survivor.level)} now, ${w(next)} after` },
      {
        label: 'Next merge cooldown',
        value: `${cooldown} completed blocks (about ${blocksToDuration(cooldown, network.blocksPerDay)})`,
      },
    ],
    warnings: [
      `Squeek #${donor.tokenId} will be burned. This cannot be undone.`,
      staked ? 'Both Squeeks are staked, so the new power counts at once.' : 'These Squeeks are in your wallet. Stake the result to earn with it.',
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
