import type { Abi, Address } from 'viem'
import { sepolia } from 'viem/chains'
import coreAbiJson from './abi/SqueekCore.json'
import miningAbiJson from './abi/SqueekMining.json'
import nftAbiJson from './abi/SqueekNFT.json'
import tokenAbiJson from './abi/SqueekToken.json'

/**
 * Single source of truth for the chain, addresses and ABIs.
 * Source: official Squeekchain docs deployment record
 * (docs.squeekchain.com/assets/abi/sepolia.json, release squeeks-sepolia-core3-mining6-001).
 * Moving to mainnet later means changing this file only.
 */
export const ACTIVE_CHAIN = sepolia
export const IS_TESTNET = true as boolean
export const NETWORK_LABEL = 'Sepolia testnet'
export const EXPLORER = 'https://eth-sepolia.blockscout.com'
export const DEPLOYMENT_BLOCK = 11902282n
export const RELEASE = 'squeeks-sepolia-core3-mining6-001'

export const SQUEEKS_COLLECTION = 0
export const MAX_CLAIM_IDS = 32
export const TOKEN_SYMBOL = 'SQK'
export const TOKEN_DECIMALS = 18

export const CONTRACTS = {
  core: {
    name: 'SqueekCore',
    address: '0x74665dAecA35A2303e767E76a2FF1FB6F93e119f' as Address,
    abi: coreAbiJson as unknown as Abi,
  },
  mining: {
    name: 'SqueekMining',
    address: '0x3beE588fC20dE788Bac17d33b41Da7346cb27EC4' as Address,
    abi: miningAbiJson as unknown as Abi,
  },
  token: {
    name: 'SqueekToken',
    address: '0x6872bfa5ccc3e9e440c6c16e5ffdabb8dba4cc76' as Address,
    abi: tokenAbiJson as unknown as Abi,
  },
  nft: {
    name: 'SqueekNFT',
    address: '0x0eAF3E0d40A0a8E5a6Ac030b2459E9FB0B7905c6' as Address,
    abi: nftAbiJson as unknown as Abi,
  },
} as const

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`
export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`

/** Withdrawal guardrails, enforced on the server. */
export const WITHDRAW_DAILY_CAP_SQK = Number(process.env.WITHDRAW_DAILY_CAP_SQK ?? '10000')
