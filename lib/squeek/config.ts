import { erc20Abi, type Abi, type Address } from 'viem'
import { sepolia } from 'viem/chains'
import { coreAbi, miningAbi, nftAbi, stakingAbi } from './abi/squeek'

/**
 * Single source of truth for the chain, addresses and ABIs.
 * Source: official Squeekchain docs, docs.squeekchain.com/developers/#deployments
 * Release core-sepolia-20261103 (revision 7). This replaced the older release
 * squeeks-sepolia-core3-mining6-001, which is no longer the live install.
 * Always re-check the docs deployment table before changing these. Moving to
 * mainnet later means changing this file only.
 */
export const ACTIVE_CHAIN = sepolia
export const IS_TESTNET = true as boolean
export const NETWORK_LABEL = 'Sepolia testnet'
export const EXPLORER = 'https://eth-sepolia.blockscout.com'
/** Ethereum block where SqueekCore was deployed. Index logs from here. */
export const DEPLOYMENT_BLOCK = 12057556n
export const RELEASE = 'core-sepolia-20261103'
/** SqueekCore genesis (round 1 start), from the docs launch configuration. */
export const GENESIS_TIMESTAMP = 1793735400

export const MAX_DEPOSIT_IDS = 100
export const TOKEN_SYMBOL = 'SQK'
export const TOKEN_DECIMALS = 18

export const CONTRACTS = {
  core: {
    name: 'SqueekCore',
    address: '0xFD6C166D4B8E2962E65746a13e5a0797CD4dE0c4' as Address,
    abi: coreAbi as unknown as Abi,
  },
  mining: {
    name: 'SqueekMining',
    address: '0x2dCcB11fcC2dEfdd188555e45aCb52231e82e218' as Address,
    abi: miningAbi as unknown as Abi,
  },
  staking: {
    name: 'SqueekStaking',
    address: '0x50fd1780526C3186A0c037c7622203bC4fb611ca' as Address,
    abi: stakingAbi as unknown as Abi,
  },
  token: {
    name: 'SqueekToken',
    address: '0xd78a3956cF63164d1Fa1C622ad3c66623162Fa1e' as Address,
    abi: erc20Abi as unknown as Abi,
  },
  nft: {
    name: 'SqueekNFT',
    address: '0xC4C7982657f00509548F3a3a41db7FA439a6856B' as Address,
    abi: nftAbi as unknown as Abi,
  },
} as const

/** The Sepolia test minter that hands out Squeeks (docs: "Sepolia test minter"). */
export const TEST_MINTER = '0xE78B4420CE205b8864F2F326f3181F9dd5EA8B5F' as Address

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`
export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`

/** Withdrawal guardrails, enforced on the server. */
export const WITHDRAW_DAILY_CAP_SQK = Number(process.env.WITHDRAW_DAILY_CAP_SQK ?? '10000')
